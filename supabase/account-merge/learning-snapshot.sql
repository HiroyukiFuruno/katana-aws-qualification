-- #58の内部snapshot部品。callerが両proofと全state lockを検証した後にだけ呼ぶ。
-- private/owner専用。公開preview/commit/migrationへは未接続。
create function kaq_private.capture_learning_snapshot(account_ids uuid[]) returns jsonb
language plpgsql stable security definer
set search_path = pg_catalog, public, kaq_private, extensions
set timezone = 'UTC'
set datestyle = 'ISO, YMD'
as $$
declare
  owners uuid[]; public_tables text[]; actual_tables text[]; table_name text;
  rows_document jsonb; tables_document jsonb := '{}'::jsonb; document jsonb; fingerprints jsonb;
begin
  if account_ids is null or array_ndims(account_ids) <> 1 or cardinality(account_ids) not between 1 and 2
    or array_position(account_ids, null) is not null
    or '00000000-0000-0000-0000-000000000000'::uuid = any(account_ids) then
    raise exception using errcode = '22023', message = 'KAQ_SNAPSHOT_SCOPE_INVALID';
  end if;
  select array_agg(distinct id order by id) into owners from unnest(account_ids) id;
  if cardinality(owners) <> cardinality(account_ids) then
    raise exception using errcode = '22023', message = 'KAQ_SNAPSHOT_SCOPE_INVALID';
  end if;
  if (select count(*) from kaq_private.learning_accounts where id = any(owners) and status = 'active')
    <> cardinality(owners) then
    raise exception using errcode = 'PT409', message = 'KAQ_SNAPSHOT_ACCOUNT_INVALID';
  end if;
  public_tables := array[
    'assessment_answers', 'dashboard_settings', 'earned_certifications', 'exam_responses',
    'exam_sessions', 'fundamentals_final_sessions', 'fundamentals_unit_progress',
    'learning_events', 'learning_state', 'migration_items', 'migration_manifests', 'roadmap_profiles'
  ];
  select array_agg(c.relname::text order by c.relname::text collate "C") into actual_tables
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attname = 'user_id' and not a.attisdropped
    where n.nspname = 'public' and c.relkind in ('r', 'p');
  if actual_tables is distinct from public_tables then
    -- 新しい所有表を追加したのにpreviewから黙って落とすことを防ぐ。
    raise exception using errcode = 'PT500', message = 'KAQ_SNAPSHOT_INVENTORY_CHANGED';
  end if;
  foreach table_name in array public_tables loop
    execute format('select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text collate "C"), ''[]''::jsonb)
      from public.%I r where user_id = any($1)', table_name) into rows_document using owners;
    tables_document := tables_document || jsonb_build_object('public.' || table_name, rows_document);
  end loop;
  foreach table_name in array array['learning_accounts', 'learning_memberships',
    'account_merge_receipts', 'account_merge_archives', 'account_merge_id_maps'] loop
    execute format('select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text collate "C"), ''[]''::jsonb)
      from kaq_private.%I r where %I = any($1)', table_name,
      case table_name when 'learning_accounts' then 'id'
        when 'learning_memberships' then 'account_id' else 'canonical_account_id' end)
      into rows_document using owners;
    tables_document := tables_document || jsonb_build_object('kaq_private.' || table_name, rows_document);
  end loop;
  if (select count(*) from public.learning_state where user_id = any(owners)) <> cardinality(owners) then
    raise exception using errcode = 'PT500', message = 'KAQ_ACCOUNT_STATE_MISSING';
  end if;
  document := jsonb_build_object('algorithm_version', 1, 'accounts', to_jsonb(owners), 'tables', tables_document);
  select jsonb_object_agg(t.key, jsonb_build_object('count', jsonb_array_length(t.value), 'row_hashes', (
    select coalesce(jsonb_agg(encode(extensions.digest(r.value::text, 'sha256'), 'hex')
      order by r.value::text collate "C"), '[]'::jsonb) from jsonb_array_elements(t.value) r(value)
  ))) into fingerprints from jsonb_each(tables_document) t;
  fingerprints := jsonb_build_object('algorithm_version', 1, 'accounts', to_jsonb(owners), 'tables', fingerprints);
  return jsonb_build_object('document', document,
    'fingerprints', fingerprints, 'digest', encode(extensions.digest(fingerprints::text, 'sha256'), 'hex'));
end $$;
revoke all on function kaq_private.capture_learning_snapshot(uuid[])
  from public, anon, authenticated, service_role;

-- この部品は単一statement snapshotで全列/NULL/行数を含む原本documentを作る。
-- membership/grant/fence/nonce/consent/全writerのlock参加はcallerの責務で、このreadだけでは統合を許可しない。
-- 将来のresume choice/replay head/設定/予定表の追加時はinventoryと保護集合を同時に拡張する。
