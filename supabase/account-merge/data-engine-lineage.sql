-- 呼出元は双方の新しい所有確認・順序付きlock・データ移動・元scopeの失効を完了させる。
-- このhelperは系譜だけを進め、account退役・membership移動・fence変更はcommit担当へ委ねる。
create function kaq_private.advance_merge_lineage(
  p_receipt_id uuid, p_source_account_id uuid, p_canonical_account_id uuid
) returns jsonb language plpgsql volatile security definer
set search_path = pg_catalog, public, kaq_private
as $$
declare receipt kaq_private.account_merge_receipts%rowtype;
  intent kaq_private.account_intents%rowtype;
  source_account kaq_private.learning_accounts%rowtype;
  canonical_account kaq_private.learning_accounts%rowtype;
  table_name text; existing kaq_private.account_merge_lineage_closure%rowtype; retired_ids uuid[];
  advanced integer := 0; has_rows boolean;
begin
  if p_receipt_id is null or p_source_account_id is null or p_canonical_account_id is null
    or p_source_account_id = p_canonical_account_id then
    raise exception using errcode = '22023', message = 'KAQ_MERGE_LINEAGE_INPUT_INVALID';
  end if;
  select * into strict receipt from kaq_private.account_merge_receipts where id = p_receipt_id for share;
  select * into strict intent from kaq_private.account_intents where id = receipt.intent_id for share;
  select * into strict source_account from kaq_private.learning_accounts where id = p_source_account_id for share;
  select * into strict canonical_account from kaq_private.learning_accounts where id = p_canonical_account_id for share;
  if receipt.canonical_account_id <> p_canonical_account_id or receipt.algorithm_version <> 2
    or intent.kind <> 'merge_existing' or intent.source_account_id <> p_source_account_id
    or intent.target_account_id <> p_canonical_account_id or intent.state <> 'committed' then
    raise exception using errcode = 'PT409', message = 'KAQ_MERGE_LINEAGE_SCOPE_CHANGED';
  end if;
  -- 片側だけ・差し替え済みscopeを受け入れると古いreceiptが後の系譜を変え得るため、元の両scopeを固定する。
  if jsonb_typeof(receipt.before_scopes) is distinct from 'array' or jsonb_array_length(receipt.before_scopes) <> 2
    or exists(select 1 from jsonb_array_elements(receipt.before_scopes) scope
      where jsonb_typeof(scope.value) is distinct from 'object'
        or (scope.value->>'account_id')::uuid not in (p_source_account_id, p_canonical_account_id)
        or coalesce((scope.value->>'generation')::bigint, -1) < 0
        or coalesce((scope.value->>'membership_revision')::bigint, -1) < 0
        or jsonb_typeof(scope.value->'memberships') is distinct from 'array'
        or jsonb_array_length((case when jsonb_typeof(scope.value->'memberships')='array' then scope.value->'memberships' else '[]'::jsonb end)) = 0
        or exists(select 1 from jsonb_array_elements((case when jsonb_typeof(scope.value->'memberships')='array' then scope.value->'memberships' else '[]'::jsonb end)) member
          where jsonb_typeof(member.value) is distinct from 'object' or (member.value->>'auth_user_id')::uuid is null
            or coalesce((member.value->>'epoch')::bigint, -1) < 0)
        or (select count(distinct (member.value->>'auth_user_id')::uuid) from jsonb_array_elements((case when jsonb_typeof(scope.value->'memberships')='array' then scope.value->'memberships' else '[]'::jsonb end)) member)
          <> jsonb_array_length((case when jsonb_typeof(scope.value->'memberships')='array' then scope.value->'memberships' else '[]'::jsonb end))
    )
    or (select count(distinct (scope.value->>'account_id')::uuid) from jsonb_array_elements(receipt.before_scopes) scope)
      <> 2
    or (select count(*) from jsonb_array_elements(receipt.before_scopes) scope
      cross join lateral jsonb_array_elements((case when jsonb_typeof(scope.value->'memberships')='array' then scope.value->'memberships' else '[]'::jsonb end)) member)
      <> (select count(distinct (member.value->>'auth_user_id')::uuid)
        from jsonb_array_elements(receipt.before_scopes) scope
        cross join lateral jsonb_array_elements((case when jsonb_typeof(scope.value->'memberships')='array' then scope.value->'memberships' else '[]'::jsonb end)) member)
    or not exists(select 1 from jsonb_array_elements(receipt.before_scopes) scope
      where (scope.value->>'account_id')::uuid = p_source_account_id)
    or not exists(select 1 from jsonb_array_elements(receipt.before_scopes) scope
      where (scope.value->>'account_id')::uuid = p_canonical_account_id)
    or not exists(select 1 from jsonb_array_elements(receipt.before_scopes) scope
      cross join lateral jsonb_array_elements((case when jsonb_typeof(scope.value->'memberships')='array' then scope.value->'memberships' else '[]'::jsonb end)) member
      where (scope.value->>'account_id')::uuid=p_source_account_id
        and (member.value->>'auth_user_id')::uuid=intent.actor_uid
        and (member.value->>'epoch')::bigint=intent.source_membership_epoch)
    or not exists(select 1 from jsonb_array_elements(receipt.before_scopes) scope
      cross join lateral jsonb_array_elements((case when jsonb_typeof(scope.value->'memberships')='array' then scope.value->'memberships' else '[]'::jsonb end)) member
      where (scope.value->>'account_id')::uuid=p_canonical_account_id
        and (member.value->>'auth_user_id')::uuid=intent.target_uid
        and (member.value->>'epoch')::bigint=intent.target_membership_epoch) then
    raise exception using errcode = 'PT409', message = 'KAQ_MERGE_LINEAGE_PROOF_CHANGED';
  end if;
  select * into existing from kaq_private.account_merge_lineage_closure
    where ancestor_account_id = p_source_account_id for share;
  if found then
    if existing.established_receipt_id = p_receipt_id then
      return jsonb_build_object('receipt_id', p_receipt_id, 'canonical_account_id', existing.current_canonical_account_id,
        'idempotent', true);
    end if;
    raise exception using errcode = 'PT409', message = 'KAQ_MERGE_LINEAGE_SOURCE_ALREADY_TERMINAL';
  end if;
  if source_account.status <> 'retired' or canonical_account.status <> 'active'
    or not exists(select 1 from public.learning_state where user_id = p_canonical_account_id)
    or exists(select 1 from kaq_private.learning_memberships where account_id = p_source_account_id) then
    raise exception using errcode = 'PT409', message = 'KAQ_MERGE_LINEAGE_OWNER_STATE_CHANGED';
  end if;
  -- closureは祖先から現在正本への写像なので、祖先として登録済みのaccountを統合先にしない。
  if exists(select 1 from kaq_private.account_merge_lineage_closure
      where ancestor_account_id = p_canonical_account_id) then
    raise exception using errcode = 'PT409', message = 'KAQ_MERGE_LINEAGE_CYCLE';
  end if;
  select array_agg(id order by id) into retired_ids from (
    select p_source_account_id id union select ancestor_account_id from kaq_private.account_merge_lineage_closure
      where current_canonical_account_id=p_source_account_id
  ) ancestors;
  if (select count(*) from kaq_private.learning_accounts where id=any(retired_ids) and status='retired') <> cardinality(retired_ids) then
    raise exception using errcode = 'PT409', message = 'KAQ_MERGE_LINEAGE_ANCESTOR_ACTIVE';
  end if;
  foreach table_name in array array[
    'assessment_answers','dashboard_settings','earned_certifications','exam_responses','exam_sessions',
    'fundamentals_final_sessions','fundamentals_unit_progress','learning_events','learning_state',
    'migration_items','migration_manifests','roadmap_profiles'
  ] loop
    execute format('select exists(select 1 from public.%I where user_id = any($1))', table_name)
      into has_rows using retired_ids;
    if has_rows then
      raise exception using errcode = 'PT409', message = 'KAQ_MERGE_LINEAGE_DATA_REMAINS';
    end if;
  end loop;
  if exists(select 1 from kaq_private.account_merge_lineage_closure closure
      join kaq_private.learning_accounts ancestor on ancestor.id = closure.ancestor_account_id
      where closure.current_canonical_account_id = p_source_account_id and ancestor.status <> 'retired') then
    raise exception using errcode = 'PT409', message = 'KAQ_MERGE_LINEAGE_ANCESTOR_ACTIVE';
  end if;
  update kaq_private.account_merge_lineage_closure set current_canonical_account_id = p_canonical_account_id,
    updated_at = clock_timestamp() where current_canonical_account_id = p_source_account_id;
  get diagnostics advanced = row_count;
  insert into kaq_private.account_merge_lineage_closure(
    ancestor_account_id, current_canonical_account_id, established_receipt_id
  ) values(p_source_account_id, p_canonical_account_id, p_receipt_id);
  return jsonb_build_object('receipt_id', p_receipt_id, 'canonical_account_id', p_canonical_account_id,
    'advanced_ancestors', advanced + 1, 'idempotent', false);
end $$;
revoke all on function kaq_private.advance_merge_lineage(uuid,uuid,uuid)
  from public, anon, authenticated, service_role;
