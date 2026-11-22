-- 既存snapshot契約を壊さず、#58の補助状態も保護するために別versionとして定義する。
-- 呼出元はエンジンと同順のlockを保持する。resolverは過去receiptやarchiveを変更しない。
create function kaq_private.resolve_merge_lineage(p_account_id uuid)
returns uuid language sql stable security definer
set search_path = pg_catalog, kaq_private
as $$
  select coalesce((select current_canonical_account_id from kaq_private.account_merge_lineage_closure
    where ancestor_account_id = p_account_id), p_account_id)
$$;
revoke all on function kaq_private.resolve_merge_lineage(uuid)
  from public, anon, authenticated, service_role;

-- v1を上書きせず、過去のcanonicalに残るimmutable証跡と全lineage/headをdigestへ加える。
create function kaq_private.capture_merge_snapshot_v2(p_accounts uuid[], p_current_receipt uuid default null)
returns jsonb language plpgsql stable security definer
set search_path = pg_catalog, public, kaq_private, extensions
set timezone = 'UTC'
set datestyle = 'ISO, YMD'
set bytea_output = 'hex'
as $$
declare snapshot jsonb; tables jsonb; fingerprints jsonb; owners uuid[]; lineage_accounts uuid[];
  table_name text; rows_document jsonb; receipt_ids uuid[]; retired_has_rows boolean;
begin
  snapshot := kaq_private.capture_learning_snapshot(p_accounts);
  select array_agg(value::uuid order by value::uuid) into owners
    from jsonb_array_elements_text(snapshot->'document'->'accounts') value;
  select array_agg(distinct id order by id) into lineage_accounts from (
    select unnest(owners) id union all
    select ancestor_account_id from kaq_private.account_merge_lineage_closure
      where current_canonical_account_id = any(owners)
  ) lineage;
  if exists(select 1 from kaq_private.account_merge_lineage_closure closure
      where closure.ancestor_account_id = any(owners))
    or exists(select 1 from kaq_private.learning_accounts account where account.id = any(lineage_accounts)
      and not account.id = any(owners) and account.status <> 'retired')
    or (select count(*) from kaq_private.learning_accounts where id = any(lineage_accounts))
      <> cardinality(lineage_accounts) then
    raise exception using errcode='PT409',message='KAQ_MERGE_LINEAGE_CHANGED';
  end if;
  -- retired祖先に残った公開行を、正本にもsnapshotにも無い記録として黙って無視しない。
  for table_name in select substr(key,8) from jsonb_each(snapshot->'document'->'tables')
    where key like 'public.%' loop
    execute format('select exists(select 1 from public.%I where user_id=any($1) and not user_id=any($2))',table_name)
      into retired_has_rows using lineage_accounts,owners;
    if retired_has_rows then
      raise exception using errcode='PT409',message='KAQ_MERGE_LINEAGE_DATA_REMAINS';
    end if;
  end loop;
  if p_current_receipt is not null and not exists(
    select 1 from kaq_private.account_merge_receipts receipt where receipt.id=p_current_receipt
      and receipt.canonical_account_id = any(owners)) then
    raise exception using errcode='PT409',message='KAQ_MERGE_RECEIPT_SCOPE_CHANGED';
  end if;
  tables := snapshot->'document'->'tables';
  foreach table_name in array array['learning_accounts','learning_memberships',
    'account_merge_receipts','account_merge_archives','account_merge_id_maps',
    'account_merge_deferred_rows','account_merge_resume_heads','account_merge_replay_heads'] loop
    execute format('select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text collate "C"), ''[]''::jsonb)
      from kaq_private.%I r where %I = any($1)', table_name,
      case table_name when 'learning_accounts' then 'id'
        when 'learning_memberships' then 'account_id' else 'canonical_account_id' end)
      into rows_document using lineage_accounts;
    if table_name='account_merge_receipts' and p_current_receipt is not null then
      select coalesce(jsonb_agg(value order by value::text collate "C"),'[]'::jsonb) into rows_document
        from jsonb_array_elements(rows_document) where (value->>'id')::uuid <> p_current_receipt;
    end if;
    tables := tables || jsonb_build_object('kaq_private.'||table_name,rows_document);
  end loop;
  select array_agg((value->>'id')::uuid order by (value->>'id')::uuid) into receipt_ids
    from jsonb_array_elements(tables->'kaq_private.account_merge_receipts');
  select coalesce(jsonb_agg(to_jsonb(choice) order by to_jsonb(choice)::text collate "C"),'[]'::jsonb)
    into rows_document from kaq_private.account_merge_resolution_choices choice
    where choice.receipt_id = any(coalesce(receipt_ids,'{}'::uuid[]));
  tables := tables || jsonb_build_object('kaq_private.account_merge_resolution_choices',rows_document);
  select coalesce(jsonb_agg(to_jsonb(closure) order by to_jsonb(closure)::text collate "C"),'[]'::jsonb)
    into rows_document from kaq_private.account_merge_lineage_closure closure
    where closure.current_canonical_account_id = any(owners)
      or closure.ancestor_account_id = any(lineage_accounts);
  tables := tables || jsonb_build_object('kaq_private.account_merge_lineage_closure',rows_document);
  select jsonb_object_agg(t.key, jsonb_build_object('count',jsonb_array_length(t.value),'row_hashes',(
    select coalesce(jsonb_agg(encode(extensions.digest(r.value::text,'sha256'),'hex')
      order by r.value::text collate "C"),'[]'::jsonb)
    from jsonb_array_elements(t.value) r(value)))) into fingerprints from jsonb_each(tables) t;
  fingerprints := jsonb_build_object('algorithm_version',2,'accounts',to_jsonb(owners),
    'lineage_accounts',to_jsonb(lineage_accounts),'tables',fingerprints);
  return jsonb_build_object('document',jsonb_build_object('algorithm_version',2,'accounts',to_jsonb(owners),
    'lineage_accounts',to_jsonb(lineage_accounts),'tables',tables),'fingerprints',fingerprints,
    'digest',encode(extensions.digest(fingerprints::text,'sha256'),'hex'));
end $$;
revoke all on function kaq_private.capture_merge_snapshot_v2(uuid[],uuid)
  from public, anon, authenticated, service_role;
