-- #58の非公開統合エンジン。公開境界が揃うまでmigrationへ登録しない。
-- 呼出元は双方の新しい所有確認・同意と、Auth→session→state→accountの順のlockを保持する。
create function kaq_private.archive_merge_snapshot(
  p_receipt_id uuid, p_canonical_account_id uuid, p_snapshot jsonb
) returns void language plpgsql volatile security definer
set search_path = pg_catalog, public, kaq_private, extensions
as $$
declare v_table_name text; v_payload jsonb; v_origin uuid; v_row_key jsonb;
begin
  foreach v_table_name in array array[
    'assessment_answers', 'dashboard_settings', 'earned_certifications', 'exam_responses',
    'exam_sessions', 'fundamentals_final_sessions', 'fundamentals_unit_progress',
    'learning_events', 'learning_state', 'migration_items', 'migration_manifests', 'roadmap_profiles'
  ] loop
    for v_payload in select value from jsonb_array_elements(p_snapshot->'document'->'tables'->('public.' || v_table_name)) loop
      v_origin := (v_payload->>'user_id')::uuid;
      v_row_key := jsonb_build_object('origin_account_id', v_origin, 'raw', v_payload);
      insert into kaq_private.account_merge_archives(receipt_id, canonical_account_id, origin_account_id,
        table_name, row_key, row_key_hash, payload, payload_hash)
      values(p_receipt_id, p_canonical_account_id, v_origin, v_table_name, v_row_key,
        extensions.digest(v_row_key::text, 'sha256'), v_payload, extensions.digest(v_payload::text, 'sha256'))
      on conflict (receipt_id, origin_account_id, table_name, row_key_hash) do nothing;
    end loop;
  end loop;
end $$;
revoke all on function kaq_private.archive_merge_snapshot(uuid,uuid,jsonb)
  from public, anon, authenticated, service_role;

create function kaq_private.record_merge_id_map(
  p_receipt_id uuid, p_canonical_account_id uuid, p_origin_account_id uuid, p_kind text,
  p_original uuid, p_canonical uuid, p_original_row jsonb, p_canonical_row jsonb
) returns void language plpgsql volatile security definer
set search_path = pg_catalog, kaq_private, extensions
as $$
begin
  insert into kaq_private.account_merge_id_maps(receipt_id, canonical_account_id, origin_account_id,
    entity_kind, original_id, canonical_id, original_row_hash, canonical_row_hash)
  values(p_receipt_id, p_canonical_account_id, p_origin_account_id, p_kind, p_original, p_canonical,
    extensions.digest(p_original_row::text, 'sha256'), extensions.digest(p_canonical_row::text, 'sha256'))
  on conflict (receipt_id, origin_account_id, entity_kind, original_id) do update
    set canonical_id = excluded.canonical_id, canonical_row_hash = excluded.canonical_row_hash;
end $$;
revoke all on function kaq_private.record_merge_id_map(uuid,uuid,uuid,text,uuid,uuid,jsonb,jsonb)
  from public, anon, authenticated, service_role;

create function kaq_private.require_merge_choice(p_choices jsonb, p_kind text, p_scope text)
returns text language plpgsql stable security definer set search_path = pg_catalog, kaq_private
as $$
declare choice text;
begin
  if jsonb_typeof(p_choices) is distinct from 'object' or p_choices->>'version' is distinct from '1' then
    raise exception using errcode = '22023', message = 'KAQ_MERGE_CHOICES_INVALID';
  end if;
  choice := p_choices->p_kind->>p_scope;
  if choice is null or choice not in ('source', 'canonical') then
    raise exception using errcode = 'PT409', message = 'KAQ_MERGE_CHOICE_REQUIRED';
  end if;
  return choice;
end $$;
revoke all on function kaq_private.require_merge_choice(jsonb,text,text)
  from public, anon, authenticated, service_role;

-- 同じscopeに複数の原本があり得るため、resume/replayの選択はoriginだけでなく原本UUIDまで固定する。
create function kaq_private.require_merge_row_choice(p_choices jsonb, p_kind text, p_scope text)
returns text language plpgsql stable security definer set search_path = pg_catalog, kaq_private
as $$
declare choice text;
begin
  if jsonb_typeof(p_choices) is distinct from 'object' or p_choices->>'version' is distinct from '1' then
    raise exception using errcode = '22023', message = 'KAQ_MERGE_CHOICES_INVALID';
  end if;
  choice := p_choices->p_kind->>p_scope;
  if choice is null or choice !~ '^(source|canonical):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception using errcode = 'PT409', message = 'KAQ_MERGE_ROW_CHOICE_REQUIRED';
  end if;
  return choice;
end $$;
revoke all on function kaq_private.require_merge_row_choice(jsonb,text,text)
  from public, anon, authenticated, service_role;

-- ゲストの重複判定は受信日時やUUIDの一致ではなく、import RPCの受理済み出典へ束縛する。
create function kaq_private.find_guest_import_map(
  p_source uuid, p_canonical uuid, p_kind text, p_original uuid, p_payload_hash bytea
) returns uuid language sql stable security definer
set search_path = pg_catalog, public, kaq_private
as $$
  select case p_kind when 'event' then canonical_item.event_id else canonical_item.exam_id end
  from public.migration_items source_item
  join public.migration_manifests source_manifest on source_manifest.user_id = p_source
    and source_manifest.manifest_id = source_item.manifest_id
  join public.migration_manifests canonical_manifest on canonical_manifest.user_id = p_canonical
    and canonical_manifest.source_name = source_manifest.source_name
    and canonical_manifest.source_schema_version = source_manifest.source_schema_version
    and canonical_manifest.source_fingerprint = source_manifest.source_fingerprint
  join public.migration_items canonical_item on canonical_item.user_id = p_canonical
    and canonical_item.manifest_id = canonical_manifest.manifest_id
    and canonical_item.source_row_id = source_item.source_row_id
    and canonical_item.outcome = 'accepted'
  left join public.learning_events canonical_event on canonical_event.user_id = p_canonical
    and canonical_event.event_id = canonical_item.event_id
  where source_item.user_id = p_source and source_item.outcome = 'accepted'
    and ((p_kind = 'event' and source_item.event_id = p_original and source_item.import_kind is null
      and source_item.payload_hash is null and canonical_item.import_kind is null
      and canonical_item.payload_hash is null and canonical_event.payload_hash = p_payload_hash)
      or (p_kind = 'exam' and source_item.exam_id = p_original and source_item.import_kind = 'exam-session'
        and canonical_item.import_kind = 'exam-session'
        and canonical_item.payload_hash = source_item.payload_hash))
  limit 1
$$;
revoke all on function kaq_private.find_guest_import_map(uuid,uuid,text,uuid,bytea)
  from public, anon, authenticated, service_role;

-- provenance/hashだけで候補を見付けても、server受信時刻以外の原本が全て同じ場合だけguest重複として畳む。
create function kaq_private.guest_exam_is_equivalent(
  p_source uuid, p_canonical uuid, p_source_exam uuid, p_canonical_exam uuid
) returns boolean language plpgsql stable security definer
set search_path = pg_catalog, public, kaq_private
as $$
declare source_exam jsonb; canonical_exam jsonb; source_event record; mapped_event uuid; expected_event jsonb;
begin
  select to_jsonb(exam) into source_exam from public.exam_sessions exam
    where exam.user_id = p_source and exam.exam_id = p_source_exam;
  select to_jsonb(exam) into canonical_exam from public.exam_sessions exam
    where exam.user_id = p_canonical and exam.exam_id = p_canonical_exam;
  if source_exam is null or canonical_exam is null
    or (jsonb_set(jsonb_set(source_exam, '{user_id}', to_jsonb(p_canonical)), '{exam_id}', to_jsonb(p_canonical_exam))
      - 'submitted_received_at') is distinct from (canonical_exam - 'submitted_received_at') then
    return false;
  end if;
  if (select count(*) from public.exam_responses where user_id = p_source and exam_id = p_source_exam)
      <> (select count(*) from public.exam_responses where user_id = p_canonical and exam_id = p_canonical_exam)
    or exists(
      select 1 from public.exam_responses source_response
      where source_response.user_id = p_source and source_response.exam_id = p_source_exam
        and not exists(select 1 from public.exam_responses canonical_response
          where canonical_response.user_id = p_canonical and canonical_response.exam_id = p_canonical_exam
            and canonical_response.question_key = source_response.question_key
            and (to_jsonb(canonical_response) - 'updated_at') =
              (jsonb_set(jsonb_set(to_jsonb(source_response), '{user_id}', to_jsonb(p_canonical)),
                '{exam_id}', to_jsonb(p_canonical_exam)) - 'updated_at'))
    ) then
    return false;
  end if;
  if (select count(*) from public.learning_events where user_id = p_source and exam_id = p_source_exam)
      <> (select count(*) from public.learning_events where user_id = p_canonical and exam_id = p_canonical_exam) then
    return false;
  end if;
  for source_event in select * from public.learning_events where user_id = p_source and exam_id = p_source_exam loop
    -- 模試のpayload hashはクライアントUUIDを含む順序付きeventを保護している。
    -- 出典は模試全体の受理済みmigration itemへ束縛し、別eventの出典と混同しない。
    mapped_event := source_event.event_id;
    expected_event := jsonb_set(jsonb_set(jsonb_set(to_jsonb(source_event), '{user_id}', to_jsonb(p_canonical)),
      '{event_id}', to_jsonb(mapped_event)), '{exam_id}', to_jsonb(p_canonical_exam));
    if mapped_event is null or not exists(select 1 from public.learning_events canonical_event
      where canonical_event.user_id = p_canonical and canonical_event.event_id = mapped_event
        and to_jsonb(canonical_event) - 'received_at' = expected_event - 'received_at') then
      return false;
    end if;
  end loop;
  return true;
end $$;
revoke all on function kaq_private.guest_exam_is_equivalent(uuid,uuid,uuid,uuid)
  from public, anon, authenticated, service_role;

create function kaq_private.guest_event_is_equivalent(
  p_source uuid, p_canonical uuid, p_source_event uuid, p_canonical_event uuid, p_canonical_exam uuid
) returns boolean language sql stable security definer
set search_path = pg_catalog, public
as $$
  select (to_jsonb(canonical_event) - 'received_at') = (
    jsonb_set(jsonb_set(jsonb_set(to_jsonb(source_event), '{user_id}', to_jsonb(p_canonical)),
      '{event_id}', to_jsonb(p_canonical_event)), '{exam_id}',
      case when source_event.exam_id is null then 'null'::jsonb else to_jsonb(p_canonical_exam) end) - 'received_at')
  from public.learning_events source_event
  join public.learning_events canonical_event on canonical_event.user_id = p_canonical
    and canonical_event.event_id = p_canonical_event
  where source_event.user_id = p_source and source_event.event_id = p_source_event
$$;
revoke all on function kaq_private.guest_event_is_equivalent(uuid,uuid,uuid,uuid,uuid)
  from public, anon, authenticated, service_role;

create function kaq_private.apply_merge_data_engine(
  p_receipt_id uuid, p_source_account_id uuid, p_canonical_account_id uuid,
  p_expected_digest text, p_expected_generation bigint, p_choices jsonb
) returns jsonb language plpgsql volatile security definer
set search_path = pg_catalog, public, kaq_private, extensions
as $$
declare snapshot jsonb; source_state public.learning_state%rowtype; canonical_state public.learning_state%rowtype;
  source_account kaq_private.learning_accounts%rowtype; canonical_account kaq_private.learning_accounts%rowtype;
  receipt kaq_private.account_merge_receipts%rowtype; row jsonb; candidate jsonb; existing jsonb;
  old_id uuid; new_id uuid; source_exam_id uuid; selected text; item text; counts jsonb := '{}'::jsonb;
  guest_equivalent boolean;
  choice_origin text; choice_original uuid; choice_session uuid; choice_manifest uuid;
  progress_row jsonb; canonical_progress public.fundamentals_unit_progress%rowtype;
  catalog_plan jsonb; merged_slides jsonb; merged_checkpoints jsonb; next_step jsonb;
  selected_active uuid; selected_passed uuid; selected_passed_at timestamptz; merged_furthest integer;
begin
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception using errcode = 'PT400', message = 'KAQ_MERGE_ISOLATION_UNSUPPORTED';
  end if;
  if p_receipt_id is null or p_source_account_id is null or p_canonical_account_id is null
    or p_source_account_id = p_canonical_account_id or p_expected_generation is null or p_expected_generation < 0
    or p_expected_digest is null or p_expected_digest !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'KAQ_MERGE_DATA_INPUT_INVALID';
  end if;
  select * into strict receipt from kaq_private.account_merge_receipts where id = p_receipt_id for update;
  if receipt.canonical_account_id <> p_canonical_account_id or receipt.algorithm_version <> 2 then
    raise exception using errcode = 'PT409', message = 'KAQ_MERGE_RECEIPT_SCOPE_CHANGED';
  end if;
  select * into strict source_account from kaq_private.learning_accounts where id = p_source_account_id for share;
  select * into strict canonical_account from kaq_private.learning_accounts where id = p_canonical_account_id for share;
  if source_account.status <> 'active' or canonical_account.status <> 'active' then
    raise exception using errcode = 'PT409', message = 'KAQ_MERGE_ACCOUNT_CHANGED';
  end if;
  select * into strict source_state from public.learning_state where user_id = p_source_account_id for update;
  select * into strict canonical_state from public.learning_state where user_id = p_canonical_account_id for update;
  if canonical_state.generation <> p_expected_generation then
    raise exception using errcode = 'PT409', message = 'KAQ_MERGE_GENERATION_CHANGED';
  end if;
  snapshot := kaq_private.capture_merge_snapshot_v2(
    array[p_source_account_id, p_canonical_account_id], p_receipt_id
  );
  if snapshot->'document'->>'algorithm_version' is distinct from '2'
    or snapshot->'fingerprints'->>'algorithm_version' is distinct from '2' then
    raise exception using errcode = 'PT500', message = 'KAQ_MERGE_SNAPSHOT_ALGORITHM_CHANGED';
  end if;
  if snapshot->>'digest' <> p_expected_digest then
    raise exception using errcode = 'PT409', message = 'KAQ_MERGE_DIGEST_CHANGED';
  end if;
  perform kaq_private.archive_merge_snapshot(p_receipt_id, p_canonical_account_id, snapshot);

  -- head は履歴ではなく現在ポインタである。過去receiptの選択やmapは後の学習操作で古くなり得るため、
  -- archive済みsnapshotと現在の公開行だけで、削除・置換するpointerの所有とscopeを検証する。
  if exists(
    select 1 from kaq_private.account_merge_resume_heads head
    where head.canonical_account_id = p_source_account_id and (
      not exists(select 1 from jsonb_array_elements(snapshot->'document'->'tables'->'public.fundamentals_final_sessions') final_row
        where (final_row.value->>'user_id')::uuid = p_source_account_id
          and (final_row.value->>'session_id')::uuid = head.session_id
          and final_row.value->>'unit_id' = head.unit_id and final_row.value->>'content_version' = head.content_version
          and final_row.value->>'state' = 'draft' and coalesce((final_row.value->>'is_active')::boolean, false))
      or not exists(select 1 from public.fundamentals_final_sessions final_session
        where final_session.user_id = p_source_account_id and final_session.session_id = head.session_id
          and final_session.unit_id = head.unit_id and final_session.content_version = head.content_version
          and final_session.state = 'draft' and final_session.is_active)
      or not exists(select 1 from jsonb_array_elements(snapshot->'document'->'tables'->'public.fundamentals_unit_progress') progress_row
        where (progress_row.value->>'user_id')::uuid = p_source_account_id
          and progress_row.value->>'unit_id' = head.unit_id and progress_row.value->>'content_version' = head.content_version
          and (progress_row.value->>'active_final_session_id')::uuid = head.session_id)
      or not exists(select 1 from public.fundamentals_unit_progress progress
        where progress.user_id = p_source_account_id and progress.unit_id = head.unit_id
          and progress.content_version = head.content_version and progress.active_final_session_id = head.session_id)
    )
  ) then
    raise exception using errcode = 'PT409', message = 'KAQ_MERGE_SOURCE_RESUME_HEAD_UNACCOUNTED';
  end if;
  if exists(
    select 1 from kaq_private.account_merge_replay_heads head
    where head.canonical_account_id = p_source_account_id and (
      not exists(select 1 from jsonb_array_elements(snapshot->'document'->'tables'->'public.migration_manifests') manifest_row
        where (manifest_row.value->>'user_id')::uuid = p_source_account_id
          and (manifest_row.value->>'manifest_id')::uuid = head.manifest_id
          and manifest_row.value->>'source_name' = head.source_name
          and manifest_row.value->>'source_fingerprint' = head.source_fingerprint)
      or not exists(select 1 from public.migration_manifests manifest
        where manifest.user_id = p_source_account_id and manifest.manifest_id = head.manifest_id
          and manifest.source_name = head.source_name and manifest.source_fingerprint = head.source_fingerprint)
    )
  ) then
    raise exception using errcode = 'PT409', message = 'KAQ_MERGE_SOURCE_REPLAY_HEAD_UNACCOUNTED';
  end if;
  -- Canonical 側の同scope pointerだけを今回の選択で置換する。対象外scopeは過去receiptの
  -- current pointerとして残すため、全削除や receipt 履歴の書換えはしない。
  if exists(
    select 1 from kaq_private.account_merge_resume_heads head
    where head.canonical_account_id = p_canonical_account_id
      and exists(select 1 from jsonb_array_elements(snapshot->'document'->'tables'->'public.fundamentals_final_sessions') source_final
        where (source_final.value->>'user_id')::uuid = p_source_account_id and source_final.value->>'state' = 'draft'
          and source_final.value->>'unit_id' = head.unit_id and source_final.value->>'content_version' = head.content_version)
      and (not exists(select 1 from public.fundamentals_final_sessions final_session
        where final_session.user_id = p_canonical_account_id and final_session.session_id = head.session_id
          and final_session.unit_id = head.unit_id and final_session.content_version = head.content_version
          and final_session.state = 'draft' and final_session.is_active)
        or not exists(select 1 from public.fundamentals_unit_progress progress
          where progress.user_id = p_canonical_account_id and progress.unit_id = head.unit_id
            and progress.content_version = head.content_version and progress.active_final_session_id = head.session_id))
  ) then
    raise exception using errcode = 'PT409', message = 'KAQ_MERGE_CANONICAL_RESUME_HEAD_UNACCOUNTED';
  end if;
  if exists(
    select 1 from kaq_private.account_merge_replay_heads head
    where head.canonical_account_id = p_canonical_account_id
      and exists(select 1 from jsonb_array_elements(snapshot->'document'->'tables'->'public.migration_manifests') source_manifest
        where (source_manifest.value->>'user_id')::uuid = p_source_account_id
          and source_manifest.value->>'source_name' = head.source_name
          and source_manifest.value->>'source_fingerprint' = head.source_fingerprint)
      and not exists(select 1 from public.migration_manifests manifest
        where manifest.user_id = p_canonical_account_id and manifest.manifest_id = head.manifest_id
          and manifest.source_name = head.source_name and manifest.source_fingerprint = head.source_fingerprint)
  ) then
    raise exception using errcode = 'PT409', message = 'KAQ_MERGE_CANONICAL_REPLAY_HEAD_UNACCOUNTED';
  end if;

  -- 子の回答・進捗・itemを誤った親へ結ばないため、先に親のID衝突対応を確定する。
  foreach item in array array['exam_sessions', 'fundamentals_final_sessions', 'migration_manifests'] loop
    for row in execute format('select value from jsonb_array_elements($1->''document''->''tables''->%L)', 'public.' || item) using snapshot loop
      if (row->>'user_id')::uuid <> p_source_account_id then continue; end if;
      old_id := (row->>case item when 'exam_sessions' then 'exam_id' when 'fundamentals_final_sessions' then 'session_id' else 'manifest_id' end)::uuid;
      candidate := jsonb_set(row, '{user_id}', to_jsonb(p_canonical_account_id));
      new_id := old_id; existing := null; guest_equivalent := false;
      if item = 'exam_sessions' then select to_jsonb(x) into existing from public.exam_sessions x where x.user_id = p_canonical_account_id and exam_id = old_id; end if;
      if item = 'fundamentals_final_sessions' then select to_jsonb(x) into existing from public.fundamentals_final_sessions x where x.user_id = p_canonical_account_id and session_id = old_id; end if;
      if item = 'migration_manifests' then select to_jsonb(x) into existing from public.migration_manifests x where x.user_id = p_canonical_account_id and manifest_id = old_id; end if;
      if item = 'exam_sessions' then
        select kaq_private.find_guest_import_map(p_source_account_id, p_canonical_account_id, 'exam', old_id, null)
          into new_id;
        if new_id is not null then
          guest_equivalent := kaq_private.guest_exam_is_equivalent(
            p_source_account_id, p_canonical_account_id, old_id, new_id
          );
          if not guest_equivalent then new_id := null; end if;
        end if;
      end if;
      -- global manifest IDs always collide with the still-present source row. Final/exam IDs collide only
      -- when a distinct canonical original already uses them; guest provenance is the sole dedup exception.
      if item = 'migration_manifests'
        or (item in ('exam_sessions', 'fundamentals_final_sessions') and existing is not null and not guest_equivalent)
        or new_id is null then
        new_id := gen_random_uuid();
      end if;
      candidate := jsonb_set(candidate, array[case item when 'exam_sessions' then 'exam_id' when 'fundamentals_final_sessions' then 'session_id' else 'manifest_id' end], to_jsonb(new_id));
      if item = 'fundamentals_final_sessions' then
        candidate := jsonb_set(candidate, '{is_active}', 'false'::jsonb);
      end if;
      perform kaq_private.record_merge_id_map(p_receipt_id, p_canonical_account_id, p_source_account_id,
        case item when 'exam_sessions' then 'exam' when 'fundamentals_final_sessions' then 'final' else 'manifest' end,
        old_id, new_id, row, candidate);
    end loop;
  end loop;

  -- 本人選択が必要な値の原本は保存済みなので、ここでは同意された側だけを採用する。
  if (select count(*) from jsonb_array_elements(snapshot->'document'->'tables'->'public.dashboard_settings')) = 2 then
    selected := kaq_private.require_merge_choice(p_choices, 'dashboard', '*');
  end if;
  if (select count(*) from jsonb_array_elements(snapshot->'document'->'tables'->'public.roadmap_profiles')) = 2 then
    selected := kaq_private.require_merge_choice(p_choices, 'roadmap', '*');
  end if;
  -- 親をID対応の確定後に複製し、子にも同じ対応を使うことで参照を保持する。
  for row in select value from jsonb_array_elements(snapshot->'document'->'tables'->'public.exam_sessions') loop
    if (row->>'user_id')::uuid <> p_source_account_id then continue; end if;
    select canonical_id into new_id from kaq_private.account_merge_id_maps where receipt_id = p_receipt_id
      and origin_account_id = p_source_account_id and entity_kind = 'exam' and original_id = (row->>'exam_id')::uuid;
    candidate := jsonb_set(jsonb_set(row, '{user_id}', to_jsonb(p_canonical_account_id)), '{exam_id}', to_jsonb(new_id));
    if not exists(select 1 from public.exam_sessions where user_id = p_canonical_account_id and exam_id = new_id) then
      insert into public.exam_sessions select * from jsonb_populate_record(null::public.exam_sessions, candidate);
    end if;
    select to_jsonb(x) into existing from public.exam_sessions x
      where x.user_id = p_canonical_account_id and x.exam_id = new_id;
    perform kaq_private.record_merge_id_map(p_receipt_id, p_canonical_account_id, p_source_account_id,
      'exam', (row->>'exam_id')::uuid, new_id, row, existing);
  end loop;
  for row in select value from jsonb_array_elements(snapshot->'document'->'tables'->'public.exam_responses') loop
    if (row->>'user_id')::uuid <> p_source_account_id then continue; end if;
    select canonical_id into new_id from kaq_private.account_merge_id_maps where receipt_id = p_receipt_id
      and origin_account_id = p_source_account_id and entity_kind = 'exam' and original_id = (row->>'exam_id')::uuid;
    candidate := jsonb_set(jsonb_set(row, '{user_id}', to_jsonb(p_canonical_account_id)), '{exam_id}', to_jsonb(new_id));
    if exists(select 1 from public.exam_responses response where response.user_id = p_canonical_account_id
      and response.exam_id = new_id and response.question_key = row->>'question_key') then
      if not exists(select 1 from public.exam_responses response where response.user_id = p_canonical_account_id
        and response.exam_id = new_id and response.question_key = row->>'question_key'
          and (to_jsonb(response) - 'updated_at') = (candidate - 'updated_at')) then
        raise exception using errcode = 'PT409', message = 'KAQ_MERGE_EXAM_RESPONSE_CONFLICT';
      end if;
    else
      insert into public.exam_responses select * from jsonb_populate_record(null::public.exam_responses, candidate);
    end if;
  end loop;
  for row in select value from jsonb_array_elements(snapshot->'document'->'tables'->'public.fundamentals_final_sessions') loop
    if (row->>'user_id')::uuid <> p_source_account_id then continue; end if;
    select canonical_id into new_id from kaq_private.account_merge_id_maps where receipt_id = p_receipt_id
      and origin_account_id = p_source_account_id and entity_kind = 'final' and original_id = (row->>'session_id')::uuid;
    candidate := jsonb_set(jsonb_set(row, '{user_id}', to_jsonb(p_canonical_account_id)), '{session_id}', to_jsonb(new_id));
    candidate := jsonb_set(candidate, '{is_active}', 'false'::jsonb);
    insert into public.fundamentals_final_sessions select * from jsonb_populate_record(null::public.fundamentals_final_sessions, candidate);
    select to_jsonb(x) into existing from public.fundamentals_final_sessions x
      where x.user_id = p_canonical_account_id and x.session_id = new_id;
    perform kaq_private.record_merge_id_map(p_receipt_id, p_canonical_account_id, p_source_account_id,
      'final', (row->>'session_id')::uuid, new_id, row, existing);
  end loop;
  -- 親の保存後にeventの全参照を書き換え、元のIDを新しい正本の参照として残さない。
  for row in select value from jsonb_array_elements(snapshot->'document'->'tables'->'public.learning_events') loop
    if (row->>'user_id')::uuid <> p_source_account_id then continue; end if;
    old_id := (row->>'event_id')::uuid;
    source_exam_id := nullif(row->>'exam_id', '')::uuid;
    if source_exam_id is not null then
      select canonical_id into new_id from kaq_private.account_merge_id_maps where receipt_id = p_receipt_id
        and origin_account_id = p_source_account_id and entity_kind = 'exam' and original_id = source_exam_id;
      if kaq_private.guest_exam_is_equivalent(p_source_account_id, p_canonical_account_id, source_exam_id, new_id) then
        new_id := old_id;
        if not kaq_private.guest_event_is_equivalent(
          p_source_account_id, p_canonical_account_id, old_id, new_id,
          (select canonical_id from kaq_private.account_merge_id_maps where receipt_id = p_receipt_id
            and origin_account_id = p_source_account_id and entity_kind = 'exam' and original_id = source_exam_id)
        ) then new_id := null; end if;
      else
        new_id := null;
      end if;
    else
      select kaq_private.find_guest_import_map(p_source_account_id, p_canonical_account_id, 'event', old_id,
        (row->>'payload_hash')::bytea) into new_id;
      if new_id is not null and not kaq_private.guest_event_is_equivalent(
        p_source_account_id, p_canonical_account_id, old_id, new_id, null
      ) then new_id := null; end if;
    end if;
    if new_id is null then new_id := gen_random_uuid(); end if;
    candidate := jsonb_set(jsonb_set(row, '{user_id}', to_jsonb(p_canonical_account_id)), '{event_id}', to_jsonb(new_id));
    if source_exam_id is not null then
      select canonical_id into old_id from kaq_private.account_merge_id_maps where receipt_id = p_receipt_id and origin_account_id = p_source_account_id and entity_kind = 'exam' and original_id = source_exam_id;
      candidate := jsonb_set(candidate, '{exam_id}', to_jsonb(old_id));
    end if;
    if row->>'fundamentals_session_id' is not null then
      source_exam_id := (row->>'fundamentals_session_id')::uuid;
      if row->'learning_context' is null
        or row->'learning_context'->>'kind' <> 'lesson-final'
        or row->'learning_context'->>'sessionId' is distinct from source_exam_id::text then
        raise exception using errcode = 'PT409', message = 'KAQ_MERGE_FINAL_EVENT_CONTEXT_CHANGED';
      end if;
      select canonical_id into old_id from kaq_private.account_merge_id_maps where receipt_id = p_receipt_id and origin_account_id = p_source_account_id and entity_kind = 'final' and original_id = source_exam_id;
      if old_id is null then raise exception using errcode = 'PT409', message = 'KAQ_MERGE_FINAL_EVENT_MAP_MISSING'; end if;
      candidate := jsonb_set(candidate, '{fundamentals_session_id}', to_jsonb(old_id));
      candidate := jsonb_set(candidate, '{learning_context,sessionId}', to_jsonb(old_id::text));
    end if;
    if not exists(select 1 from public.learning_events where user_id = p_canonical_account_id and event_id = new_id) then
      insert into public.learning_events select * from jsonb_populate_record(null::public.learning_events, candidate);
    end if;
    select to_jsonb(x) into existing from public.learning_events x
      where x.user_id = p_canonical_account_id and x.event_id = new_id;
    perform kaq_private.record_merge_id_map(p_receipt_id, p_canonical_account_id, p_source_account_id, 'event',
      (row->>'event_id')::uuid, new_id, row, existing);
  end loop;
  for row in select value from jsonb_array_elements(snapshot->'document'->'tables'->'public.migration_manifests') loop
    if (row->>'user_id')::uuid <> p_source_account_id then continue; end if;
    select canonical_id into new_id from kaq_private.account_merge_id_maps where receipt_id = p_receipt_id
      and origin_account_id = p_source_account_id and entity_kind = 'manifest' and original_id = (row->>'manifest_id')::uuid;
    candidate := jsonb_set(jsonb_set(row, '{user_id}', to_jsonb(p_canonical_account_id)), '{manifest_id}', to_jsonb(new_id));
    insert into public.migration_manifests select * from jsonb_populate_record(null::public.migration_manifests, candidate);
    select to_jsonb(x) into existing from public.migration_manifests x
      where x.user_id = p_canonical_account_id and x.manifest_id = new_id;
    perform kaq_private.record_merge_id_map(p_receipt_id, p_canonical_account_id, p_source_account_id,
      'manifest', (row->>'manifest_id')::uuid, new_id, row, existing);
  end loop;
  for row in select value from jsonb_array_elements(snapshot->'document'->'tables'->'public.migration_items') loop
    if (row->>'user_id')::uuid <> p_source_account_id then continue; end if;
    select canonical_id into new_id from kaq_private.account_merge_id_maps where receipt_id = p_receipt_id
      and origin_account_id = p_source_account_id and entity_kind = 'manifest' and original_id = (row->>'manifest_id')::uuid;
    candidate := jsonb_set(jsonb_set(row, '{user_id}', to_jsonb(p_canonical_account_id)), '{manifest_id}', to_jsonb(new_id));
    if row->>'event_id' is not null then
      select canonical_id into new_id from kaq_private.account_merge_id_maps where receipt_id = p_receipt_id and origin_account_id = p_source_account_id and entity_kind = 'event' and original_id = (row->>'event_id')::uuid;
      candidate := jsonb_set(candidate, '{event_id}', to_jsonb(new_id));
    end if;
    if row->>'exam_id' is not null then
      select canonical_id into new_id from kaq_private.account_merge_id_maps where receipt_id = p_receipt_id and origin_account_id = p_source_account_id and entity_kind = 'exam' and original_id = (row->>'exam_id')::uuid;
      candidate := jsonb_set(candidate, '{exam_id}', to_jsonb(new_id));
    end if;
    insert into public.migration_items select * from jsonb_populate_record(null::public.migration_items, candidate);
  end loop;
  -- 同じscopeの過去draft/manifestも残すため、反復順や日時順ではなく原本UUIDで選択を固定する。
  for row in
    select jsonb_build_object('unit_id', value->>'unit_id', 'content_version', value->>'content_version')
    from jsonb_array_elements(snapshot->'document'->'tables'->'public.fundamentals_final_sessions')
    where (value->>'user_id')::uuid = p_source_account_id and value->>'state' = 'draft'
    group by value->>'unit_id', value->>'content_version'
  loop
    selected := kaq_private.require_merge_row_choice(p_choices, 'final_resume',
      (row->>'unit_id') || ':' || (row->>'content_version'));
    choice_origin := split_part(selected, ':', 1);
    choice_original := split_part(selected, ':', 2)::uuid;
    if choice_origin = 'source' then
      if not exists(select 1 from jsonb_array_elements(snapshot->'document'->'tables'->'public.fundamentals_final_sessions') source_final
        where (source_final.value->>'user_id')::uuid = p_source_account_id
          and (source_final.value->>'session_id')::uuid = choice_original
          and source_final.value->>'unit_id' = row->>'unit_id'
          and source_final.value->>'content_version' = row->>'content_version'
          and source_final.value->>'state' = 'draft') then
        raise exception using errcode = 'PT409', message = 'KAQ_MERGE_FINAL_CHOICE_SCOPE_CHANGED';
      end if;
      select canonical_id into choice_session from kaq_private.account_merge_id_maps where receipt_id = p_receipt_id
        and origin_account_id = p_source_account_id and entity_kind = 'final' and original_id = choice_original;
    else
      select session_id into choice_session from public.fundamentals_final_sessions
        where user_id = p_canonical_account_id and session_id = choice_original
          and unit_id = row->>'unit_id' and content_version = row->>'content_version' and state = 'draft';
    end if;
    if choice_session is null then
      raise exception using errcode = 'PT409', message = 'KAQ_MERGE_FINAL_CHOICE_MISSING';
    end if;
    update public.fundamentals_final_sessions set is_active = false where user_id = p_canonical_account_id
      and unit_id = row->>'unit_id' and content_version = row->>'content_version' and state = 'draft';
    update public.fundamentals_final_sessions set is_active = true where user_id = p_canonical_account_id
      and session_id = choice_session and unit_id = row->>'unit_id' and content_version = row->>'content_version'
        and state = 'draft';
    if not found then raise exception using errcode = 'PT409', message = 'KAQ_MERGE_FINAL_CHOICE_MISSING'; end if;
    delete from kaq_private.account_merge_resume_heads head where head.canonical_account_id = p_canonical_account_id
      and head.unit_id = row->>'unit_id' and head.content_version = row->>'content_version';
    insert into kaq_private.account_merge_resume_heads(receipt_id, canonical_account_id, unit_id, content_version,
      session_id, origin_account_id) values(p_receipt_id, p_canonical_account_id, row->>'unit_id', row->>'content_version',
      choice_session, case when choice_origin = 'source' then p_source_account_id else p_canonical_account_id end)
    on conflict (receipt_id, unit_id, content_version) do update set session_id = excluded.session_id, origin_account_id = excluded.origin_account_id;
  end loop;
  -- ヘッド確定で source 由来 draft の is_active が変わる。原本ハッシュは監査証跡のまま残し、
  -- 今回の receipt と source に属する final map だけを、確定後の canonical 行へ更新する。
  update kaq_private.account_merge_id_maps id_map
    set canonical_row_hash = extensions.digest(to_jsonb(final_session)::text, 'sha256')
    from public.fundamentals_final_sessions final_session
    where id_map.receipt_id = p_receipt_id
      and id_map.origin_account_id = p_source_account_id
      and id_map.entity_kind = 'final'
      and final_session.user_id = p_canonical_account_id
      and final_session.session_id = id_map.canonical_id;
  for row in
    select jsonb_build_object('source_name', value->>'source_name', 'source_fingerprint', value->>'source_fingerprint')
    from jsonb_array_elements(snapshot->'document'->'tables'->'public.migration_manifests')
    where (value->>'user_id')::uuid = p_source_account_id
    group by value->>'source_name', value->>'source_fingerprint'
  loop
    selected := kaq_private.require_merge_row_choice(p_choices, 'manifest_head',
      (row->>'source_name') || ':' || (row->>'source_fingerprint'));
    choice_origin := split_part(selected, ':', 1);
    choice_original := split_part(selected, ':', 2)::uuid;
    if choice_origin = 'source' then
      if not exists(select 1 from jsonb_array_elements(snapshot->'document'->'tables'->'public.migration_manifests') source_manifest
        where (source_manifest.value->>'user_id')::uuid = p_source_account_id
          and (source_manifest.value->>'manifest_id')::uuid = choice_original
          and source_manifest.value->>'source_name' = row->>'source_name'
          and source_manifest.value->>'source_fingerprint' = row->>'source_fingerprint') then
        raise exception using errcode = 'PT409', message = 'KAQ_MERGE_MANIFEST_CHOICE_SCOPE_CHANGED';
      end if;
      select canonical_id into choice_manifest from kaq_private.account_merge_id_maps where receipt_id = p_receipt_id
        and origin_account_id = p_source_account_id and entity_kind = 'manifest' and original_id = choice_original;
    else
      select manifest_id into choice_manifest from public.migration_manifests
        where user_id = p_canonical_account_id and manifest_id = choice_original
          and source_name = row->>'source_name' and source_fingerprint = row->>'source_fingerprint';
    end if;
    if choice_manifest is null then
      raise exception using errcode = 'PT409', message = 'KAQ_MERGE_MANIFEST_CHOICE_MISSING';
    end if;
    delete from kaq_private.account_merge_replay_heads head where head.canonical_account_id = p_canonical_account_id
      and head.source_name = row->>'source_name' and head.source_fingerprint = row->>'source_fingerprint';
    insert into kaq_private.account_merge_replay_heads(receipt_id, canonical_account_id, source_name, source_fingerprint,
      manifest_id, origin_account_id) values(p_receipt_id, p_canonical_account_id, row->>'source_name', row->>'source_fingerprint',
      choice_manifest, case when choice_origin = 'source' then p_source_account_id else p_canonical_account_id end)
    on conflict (receipt_id, source_name, source_fingerprint) do update set manifest_id = excluded.manifest_id, origin_account_id = excluded.origin_account_id;
  end loop;
  -- 取得資格は安定IDの和集合と早い取得日時を採用する。双方の原本は非公開archiveに保持する。
  insert into public.earned_certifications(user_id, certification_id, recorded_at)
    select p_canonical_account_id, value->>'certification_id', (value->>'recorded_at')::timestamptz
    from jsonb_array_elements(snapshot->'document'->'tables'->'public.earned_certifications')
    where (value->>'user_id')::uuid = p_source_account_id
    on conflict (user_id, certification_id) do update set recorded_at = least(public.earned_certifications.recorded_at, excluded.recorded_at);
  for row in select value from jsonb_array_elements(snapshot->'document'->'tables'->'public.assessment_answers') loop
    if (row->>'user_id')::uuid <> p_source_account_id then continue; end if;
    if exists(select 1 from public.assessment_answers where user_id = p_canonical_account_id and assessment_id = row->>'assessment_id') then
      selected := kaq_private.require_merge_choice(p_choices, 'assessment', row->>'assessment_id');
      if selected = 'source' then update public.assessment_answers set answer = (row->>'answer')::integer,
        updated_at = clock_timestamp() where user_id = p_canonical_account_id and assessment_id = row->>'assessment_id'; end if;
    else
      candidate := jsonb_set(row, '{user_id}', to_jsonb(p_canonical_account_id));
      insert into public.assessment_answers select * from jsonb_populate_record(null::public.assessment_answers, candidate);
    end if;
  end loop;
  for row in select value from jsonb_array_elements(snapshot->'document'->'tables'->'public.dashboard_settings') loop
    if (row->>'user_id')::uuid <> p_source_account_id then continue; end if;
    selected := kaq_private.require_merge_choice(p_choices, 'dashboard', '*');
    if not exists(select 1 from public.dashboard_settings where user_id = p_canonical_account_id) then
      candidate := jsonb_set(row, '{user_id}', to_jsonb(p_canonical_account_id));
      insert into public.dashboard_settings select * from jsonb_populate_record(null::public.dashboard_settings, candidate);
    elsif selected = 'source' then update public.dashboard_settings set settings = row->'settings',
      revision = greatest(revision, (row->>'revision')::bigint) + 1,
      updated_at = clock_timestamp() where user_id = p_canonical_account_id; end if;
  end loop;
  for row in select value from jsonb_array_elements(snapshot->'document'->'tables'->'public.roadmap_profiles') loop
    if (row->>'user_id')::uuid <> p_source_account_id then continue; end if;
    selected := kaq_private.require_merge_choice(p_choices, 'roadmap', '*');
    if not exists(select 1 from public.roadmap_profiles where user_id = p_canonical_account_id) then
      candidate := jsonb_set(row, '{user_id}', to_jsonb(p_canonical_account_id));
      insert into public.roadmap_profiles select * from jsonb_populate_record(null::public.roadmap_profiles, candidate);
    elsif selected = 'source' then update public.roadmap_profiles set revision = greatest(revision, (row->>'revision')::bigint) + 1
      where user_id = p_canonical_account_id; end if;
  end loop;
  -- IDの和集合だけでは未選択draftや必須stepの飛ばしを招くため、原本保存後にcatalogと明示headから進捗を再構成する。
  for progress_row in select value from jsonb_array_elements(snapshot->'document'->'tables'->'public.fundamentals_unit_progress') loop
    if (progress_row->>'user_id')::uuid <> p_source_account_id then continue; end if;
    if not exists(select 1 from public.fundamentals_unit_progress where user_id = p_canonical_account_id
      and unit_id = progress_row->>'unit_id' and content_version = progress_row->>'content_version') then
      candidate := jsonb_set(progress_row, '{user_id}', to_jsonb(p_canonical_account_id));
      candidate := jsonb_set(candidate, '{active_final_session_id}', 'null'::jsonb);
      candidate := jsonb_set(candidate, '{passed_final_session_id}', 'null'::jsonb);
      candidate := jsonb_set(candidate, '{passed_at}', 'null'::jsonb);
      insert into public.fundamentals_unit_progress
        select * from jsonb_populate_record(null::public.fundamentals_unit_progress, candidate);
    end if;
    select * into strict canonical_progress from public.fundamentals_unit_progress
      where user_id = p_canonical_account_id and unit_id = progress_row->>'unit_id'
        and content_version = progress_row->>'content_version' for update;
    select plan into strict catalog_plan from public.published_fundamentals_catalogs
      where unit_id = canonical_progress.unit_id and content_version = canonical_progress.content_version;
    select coalesce(jsonb_agg(distinct completed_id order by completed_id), '[]'::jsonb) into merged_slides
      from (
        select value as completed_id from jsonb_array_elements_text(canonical_progress.completed_slide_ids)
        union
        select value from jsonb_array_elements_text(progress_row->'completed_slide_ids')
      ) completed
      join jsonb_array_elements(catalog_plan) catalog(value)
        on catalog.value->>'kind' = 'slide' and catalog.value->>'id' = completed.completed_id;
    select coalesce(jsonb_agg(distinct completed_id order by completed_id), '[]'::jsonb) into merged_checkpoints
      from (
        select value as completed_id from jsonb_array_elements_text(canonical_progress.completed_checkpoint_ids)
        union
        select value from jsonb_array_elements_text(progress_row->'completed_checkpoint_ids')
      ) completed
      join jsonb_array_elements(catalog_plan) catalog(value)
        on catalog.value->>'kind' = 'checkpoint' and catalog.value->>'id' = completed.completed_id;
    select catalog.value into next_step from jsonb_array_elements(catalog_plan) catalog(value)
      where coalesce((catalog.value->>'required')::boolean, false)
        and ((catalog.value->>'kind' = 'slide' and not (merged_slides ? (catalog.value->>'id')))
          or (catalog.value->>'kind' = 'checkpoint' and not (merged_checkpoints ? (catalog.value->>'id'))))
      order by (catalog.value->>'position')::integer limit 1;
    select coalesce(max((catalog.value->>'position')::integer), 0) into merged_furthest
      from jsonb_array_elements(catalog_plan) catalog(value)
      where next_step is null or (catalog.value->>'position')::integer < (next_step->>'position')::integer;
    selected_active := null;
    select head.session_id into selected_active from kaq_private.account_merge_resume_heads head
      join public.fundamentals_final_sessions final_session on final_session.user_id = p_canonical_account_id
        and final_session.session_id = head.session_id and final_session.unit_id = canonical_progress.unit_id
        and final_session.content_version = canonical_progress.content_version and final_session.state = 'draft'
        and final_session.is_active
      where head.receipt_id = p_receipt_id and head.canonical_account_id = p_canonical_account_id
        and head.unit_id = canonical_progress.unit_id and head.content_version = canonical_progress.content_version;
    if selected_active is null then
      select final_session.session_id into selected_active from public.fundamentals_final_sessions final_session
        where final_session.user_id = p_canonical_account_id and final_session.session_id = canonical_progress.active_final_session_id
          and final_session.unit_id = canonical_progress.unit_id and final_session.content_version = canonical_progress.content_version
          and final_session.state = 'draft' and final_session.is_active;
    end if;
    selected_passed := null; selected_passed_at := null;
    select final_session.session_id, canonical_progress.passed_at into selected_passed, selected_passed_at
      from public.fundamentals_final_sessions final_session
      where final_session.user_id = p_canonical_account_id and final_session.session_id = canonical_progress.passed_final_session_id
        and final_session.unit_id = canonical_progress.unit_id and final_session.content_version = canonical_progress.content_version
        and final_session.state = 'submitted' and final_session.passed;
    if selected_passed is null and progress_row->>'passed_final_session_id' is not null then
      select canonical_id into new_id from kaq_private.account_merge_id_maps where receipt_id = p_receipt_id
        and origin_account_id = p_source_account_id and entity_kind = 'final'
        and original_id = (progress_row->>'passed_final_session_id')::uuid;
      select final_session.session_id, (progress_row->>'passed_at')::timestamptz into selected_passed, selected_passed_at
        from public.fundamentals_final_sessions final_session where final_session.user_id = p_canonical_account_id
          and final_session.session_id = new_id and final_session.unit_id = canonical_progress.unit_id
          and final_session.content_version = canonical_progress.content_version and final_session.state = 'submitted'
          and final_session.passed;
    end if;
    update public.fundamentals_unit_progress set
      completed_slide_ids = merged_slides,
      completed_checkpoint_ids = merged_checkpoints,
      furthest_plan_position = greatest(canonical_progress.furthest_plan_position, merged_furthest),
      resume_stage = case when selected_active is not null then 'final'
        when selected_passed is not null then 'result'
        else coalesce(next_step->>'kind', 'final') end,
      resume_step_id = case when selected_active is not null or selected_passed is not null or next_step is null then null
        else next_step->>'id' end,
      active_final_session_id = selected_active,
      passed_final_session_id = selected_passed,
      passed_at = selected_passed_at,
      revision = greatest(canonical_progress.revision, (progress_row->>'revision')::bigint) + 1,
      last_mutation_id = null,
      last_mutation_hash = null,
      updated_at = clock_timestamp()
      where user_id = p_canonical_account_id and unit_id = canonical_progress.unit_id
        and content_version = canonical_progress.content_version;
  end loop;
  -- source の current pointerは上でsnapshot/live public行の整合を検証済みであり、source公開行を
  -- 削除する直前にだけ外す。過去receipt・archive・map・choiceは更新も削除もしない。
  delete from kaq_private.account_merge_resume_heads where canonical_account_id = p_source_account_id;
  delete from kaq_private.account_merge_replay_heads where canonical_account_id = p_source_account_id;
  delete from public.learning_events where user_id = p_source_account_id;
  delete from public.exam_responses where user_id = p_source_account_id;
  delete from public.exam_sessions where user_id = p_source_account_id;
  delete from public.fundamentals_unit_progress where user_id = p_source_account_id;
  delete from public.fundamentals_final_sessions where user_id = p_source_account_id;
  delete from public.migration_items where user_id = p_source_account_id;
  delete from public.migration_manifests where user_id = p_source_account_id;
  delete from public.earned_certifications where user_id = p_source_account_id;
  delete from public.assessment_answers where user_id = p_source_account_id;
  delete from public.dashboard_settings where user_id = p_source_account_id;
  delete from public.roadmap_profiles where user_id = p_source_account_id;
  delete from public.learning_state where user_id = p_source_account_id;
  counts := jsonb_build_object('snapshot_digest', p_expected_digest, 'archived_tables', 12,
    'canonical_generation', canonical_state.generation, 'continuity_promoted', false);
  update kaq_private.account_merge_receipts set result = result || jsonb_build_object('data_engine', counts)
    where id = p_receipt_id;
  return counts;
end $$;
revoke all on function kaq_private.apply_merge_data_engine(uuid,uuid,uuid,text,bigint,jsonb)
  from public, anon, authenticated, service_role;
