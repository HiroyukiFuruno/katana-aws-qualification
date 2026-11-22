-- Native fixture source: the helper seeds both real OAuth owners with all 12 tables.
-- It runs inside the helper's one rollback-only transaction; no mock or timeout is permitted.
create temporary table data_engine_checks(name text primary key) on commit drop;
create temporary table data_engine_projection_snapshots(
  provenance text primary key check(provenance in ('source', 'target')),
  account_id uuid not null,
  snapshot jsonb not null
) on commit drop;
create function pg_temp.data_engine_assert(label text, passed boolean) returns void language plpgsql as $$
begin
  if passed is distinct from true then raise exception 'Data engine assertion failed: %', label; end if;
  insert into data_engine_checks values(label);
end $$;
do $$
declare relation text; function_exists boolean;
begin
  select exists(select 1 from pg_proc where pronamespace = 'kaq_private'::regnamespace
    and proname = 'apply_merge_data_engine') into function_exists;
  perform pg_temp.data_engine_assert('private_engine_installed', function_exists);
  foreach relation in array array[
    'assessment_answers', 'dashboard_settings', 'earned_certifications', 'exam_responses',
    'exam_sessions', 'fundamentals_final_sessions', 'fundamentals_unit_progress',
    'learning_events', 'learning_state', 'migration_items', 'migration_manifests', 'roadmap_profiles'
  ] loop
    perform pg_temp.data_engine_assert('archive_contract_' || relation,
      exists(select 1 from pg_constraint where conrelid = 'kaq_private.account_merge_archives'::regclass));
  end loop;
  perform pg_temp.data_engine_assert('private_acl', not has_function_privilege('authenticated',
    'kaq_private.apply_merge_data_engine(uuid,uuid,uuid,text,bigint,jsonb)', 'EXECUTE'));
  foreach relation in array array[
    'account_merge_resolution_choices', 'account_merge_deferred_rows',
    'account_merge_resume_heads', 'account_merge_replay_heads', 'account_merge_lineage_closure'
  ] loop
    perform pg_temp.data_engine_assert('proposal_rls_' || relation,
      exists(select 1 from pg_class where oid = ('kaq_private.' || relation)::regclass and relrowsecurity));
    perform pg_temp.data_engine_assert('proposal_api_privileges_' || relation, not exists(
      select 1 from unnest(array['anon', 'authenticated', 'service_role']) api_role
      where has_table_privilege(api_role, 'kaq_private.' || relation, 'select')
        or has_table_privilege(api_role, 'kaq_private.' || relation, 'insert')
        or has_table_privilege(api_role, 'kaq_private.' || relation, 'update')
        or has_table_privilege(api_role, 'kaq_private.' || relation, 'delete')
        or has_table_privilege(api_role, 'kaq_private.' || relation, 'truncate')
        or has_table_privilege(api_role, 'kaq_private.' || relation, 'references')
        or has_table_privilege(api_role, 'kaq_private.' || relation, 'trigger')
    ));
  end loop;
end $$;
do $$
declare source_account uuid := '__SOURCE_ACCOUNT__'; canonical_account uuid := '__CANONICAL_ACCOUNT__';
  current_intent uuid := '__INTENT_ID__'; receipt uuid := '__RECEIPT_ID__'; snapshot jsonb; source_snapshot jsonb; target_snapshot jsonb; digest text;
  table_key text; snapshot_count bigint; archive_count bigint; canonical_count bigint; current_canonical_count bigint;
  source_rows jsonb; map_count bigint; source_gone boolean;
  choice_row jsonb; selected_row jsonb; fixture_row jsonb; choices jsonb := '{"version":1,"assessment":{},"dashboard":{"*":"source"},"roadmap":{"*":"source"},"final_resume":{},"manifest_head":{}}';
  collision_exam uuid := gen_random_uuid(); collision_event uuid := gen_random_uuid(); collision_final uuid;
  collision_final_event uuid := gen_random_uuid();
  inactive_source_final uuid := gen_random_uuid(); source_only_final uuid := gen_random_uuid();
  source_manifest uuid; canonical_manifest uuid; target_only_manifest uuid := gen_random_uuid();
  current_source_manifest uuid := gen_random_uuid(); current_canonical_manifest uuid := gen_random_uuid();
  source_head_final uuid; canonical_head_final uuid; source_head_unit text; source_head_version text;
  current_source_final uuid := gen_random_uuid(); current_canonical_final uuid := gen_random_uuid();
  prior_source_intent uuid := gen_random_uuid(); prior_canonical_intent uuid := gen_random_uuid();
  prior_source_receipt uuid := gen_random_uuid(); prior_canonical_receipt uuid := gen_random_uuid();
  prior_source_origin uuid := gen_random_uuid(); prior_canonical_origin uuid := gen_random_uuid();
  prior_source_final_original uuid := gen_random_uuid(); prior_source_manifest_original uuid := gen_random_uuid();
  prior_canonical_final_original uuid := gen_random_uuid(); prior_canonical_manifest_original uuid := gen_random_uuid();
  prior_source_choices jsonb; prior_canonical_choices jsonb; source_only_unit text; source_only_version text;
begin
  -- 固定入力で「provenanceは一致するが原本は異なる」guest exam と、同scopeの複数draftを作る。
  -- 旧実装の衝突reuse・全response INSERT・last-row-wins を実DB上で必ず再現する。
  select manifest_id into strict source_manifest from public.migration_manifests
    where user_id = source_account and source_name = 'history-local-storage' and source_fingerprint = repeat('a', 64);
  select manifest_id into strict canonical_manifest from public.migration_manifests
    where user_id = canonical_account and source_name = 'history-local-storage' and source_fingerprint = repeat('a', 64);
  select session_id, unit_id, content_version into strict source_head_final, source_head_unit, source_head_version
    from public.fundamentals_final_sessions
    where user_id = source_account and state = 'draft' and is_active limit 1;
  select session_id into strict canonical_head_final from public.fundamentals_final_sessions
    where user_id = canonical_account and unit_id = source_head_unit and content_version = source_head_version
      and state = 'draft' and is_active;
  -- 過去receiptの選択とは異なるdraftを、ユーザーが後から現在resumeとして選んだ状態を作る。
  select to_jsonb(final_session) into strict fixture_row from public.fundamentals_final_sessions final_session
    where user_id = source_account and session_id = source_head_final;
  update public.fundamentals_final_sessions set is_active = false
    where user_id = source_account and session_id = source_head_final;
  fixture_row := jsonb_set(fixture_row, '{session_id}', to_jsonb(current_source_final));
  fixture_row := jsonb_set(fixture_row, '{is_active}', 'true'::jsonb);
  insert into public.fundamentals_final_sessions select * from jsonb_populate_record(null::public.fundamentals_final_sessions, fixture_row);
  update public.fundamentals_unit_progress set active_final_session_id = current_source_final
    where user_id = source_account and unit_id = source_head_unit and content_version = source_head_version;
  select to_jsonb(final_session) into strict fixture_row from public.fundamentals_final_sessions final_session
    where user_id = canonical_account and session_id = canonical_head_final;
  update public.fundamentals_final_sessions set is_active = false
    where user_id = canonical_account and session_id = canonical_head_final;
  fixture_row := jsonb_set(fixture_row, '{session_id}', to_jsonb(current_canonical_final));
  fixture_row := jsonb_set(fixture_row, '{is_active}', 'true'::jsonb);
  insert into public.fundamentals_final_sessions select * from jsonb_populate_record(null::public.fundamentals_final_sessions, fixture_row);
  update public.fundamentals_unit_progress set active_final_session_id = current_canonical_final
    where user_id = canonical_account and unit_id = source_head_unit and content_version = source_head_version;
  -- replay pointerも旧receiptのmanifestではなく、同一source scopeで進行した新manifestを指す。
  select to_jsonb(manifest) into strict fixture_row from public.migration_manifests manifest
    where user_id = source_account and manifest_id = source_manifest;
  fixture_row := jsonb_set(fixture_row, '{manifest_id}', to_jsonb(current_source_manifest));
  fixture_row := jsonb_set(fixture_row, '{status}', '"completed"'::jsonb);
  fixture_row := jsonb_set(fixture_row, '{completed_at}', to_jsonb(clock_timestamp()));
  insert into public.migration_manifests select * from jsonb_populate_record(null::public.migration_manifests, fixture_row);
  select to_jsonb(manifest) into strict fixture_row from public.migration_manifests manifest
    where user_id = canonical_account and manifest_id = canonical_manifest;
  fixture_row := jsonb_set(fixture_row, '{manifest_id}', to_jsonb(current_canonical_manifest));
  fixture_row := jsonb_set(fixture_row, '{status}', '"completed"'::jsonb);
  fixture_row := jsonb_set(fixture_row, '{completed_at}', to_jsonb(clock_timestamp()));
  insert into public.migration_manifests select * from jsonb_populate_record(null::public.migration_manifests, fixture_row);
  select to_jsonb(manifest) into strict fixture_row from public.migration_manifests manifest
    where user_id = canonical_account and manifest_id = canonical_manifest;
  fixture_row := jsonb_set(fixture_row, '{manifest_id}', to_jsonb(target_only_manifest));
  fixture_row := jsonb_set(fixture_row, '{source_fingerprint}', to_jsonb(repeat('f', 64)));
  insert into public.migration_manifests select * from jsonb_populate_record(null::public.migration_manifests, fixture_row);
  prior_source_choices := jsonb_build_object('version', 1,
    'final_resume', jsonb_build_object(source_head_unit || ':' || source_head_version, 'source:' || prior_source_final_original::text),
    'manifest_head', jsonb_build_object('history-local-storage:' || repeat('a', 64), 'source:' || prior_source_manifest_original::text));
  prior_canonical_choices := jsonb_build_object('version', 1,
    'final_resume', jsonb_build_object(source_head_unit || ':' || source_head_version, 'source:' || prior_canonical_final_original::text),
    'manifest_head', jsonb_build_object(
      'history-local-storage:' || repeat('a', 64), 'source:' || prior_canonical_manifest_original::text,
      'history-local-storage:' || repeat('f', 64), 'canonical:' || target_only_manifest::text));
  -- 現在pointerの置換を実在DDLで再現する。過去receiptのchoiceは後続mergeで書き換えない。
  insert into kaq_private.account_intents(id, kind, actor_uid, actor_session_id, secret_hash, state,
    source_account_id, source_membership_epoch, target_uid, target_account_id, target_membership_epoch, expires_at)
    select prior_source_intent, kind, actor_uid, actor_session_id, secret_hash, 'committed',
      source_account_id, source_membership_epoch, target_uid, target_account_id, target_membership_epoch,
      clock_timestamp() + interval '5 minutes'
    from kaq_private.account_intents where id = current_intent;
  insert into kaq_private.account_intents(id, kind, actor_uid, actor_session_id, secret_hash, state,
    source_account_id, source_membership_epoch, target_uid, target_account_id, target_membership_epoch, expires_at)
    select prior_canonical_intent, kind, actor_uid, actor_session_id, secret_hash, 'committed',
      source_account_id, source_membership_epoch, target_uid, target_account_id, target_membership_epoch,
      clock_timestamp() + interval '5 minutes'
    from kaq_private.account_intents where id = current_intent;
  insert into kaq_private.account_merge_receipts(
    id, intent_id, canonical_account_id, algorithm_version, consent_hash, before_scopes, choices, result
  ) values
    (prior_source_receipt, prior_source_intent, source_account, 2, decode(repeat('ac', 32), 'hex'), '[]', prior_source_choices, '{}'),
    (prior_canonical_receipt, prior_canonical_intent, canonical_account, 2, decode(repeat('ad', 32), 'hex'), '[]', prior_canonical_choices, '{}');
  insert into kaq_private.account_merge_id_maps(
    receipt_id, canonical_account_id, origin_account_id, entity_kind, original_id, canonical_id,
    original_row_hash, canonical_row_hash
  )
    select prior_source_receipt, source_account, prior_source_origin, 'final', prior_source_final_original, source_head_final,
      extensions.digest('{}'::text, 'sha256'), extensions.digest(to_jsonb(final_session)::text, 'sha256')
    from public.fundamentals_final_sessions final_session where final_session.user_id = source_account
      and final_session.session_id = source_head_final
    union all
    select prior_source_receipt, source_account, prior_source_origin, 'manifest', prior_source_manifest_original, source_manifest,
      extensions.digest('{}'::text, 'sha256'), extensions.digest(to_jsonb(manifest)::text, 'sha256')
    from public.migration_manifests manifest where manifest.user_id = source_account and manifest.manifest_id = source_manifest
    union all
    select prior_canonical_receipt, canonical_account, prior_canonical_origin, 'final', prior_canonical_final_original, canonical_head_final,
      extensions.digest('{}'::text, 'sha256'), extensions.digest(to_jsonb(final_session)::text, 'sha256')
    from public.fundamentals_final_sessions final_session where final_session.user_id = canonical_account
      and final_session.session_id = canonical_head_final
    union all
    select prior_canonical_receipt, canonical_account, prior_canonical_origin, 'manifest', prior_canonical_manifest_original, canonical_manifest,
      extensions.digest('{}'::text, 'sha256'), extensions.digest(to_jsonb(manifest)::text, 'sha256')
    from public.migration_manifests manifest where manifest.user_id = canonical_account and manifest.manifest_id = canonical_manifest;
  insert into kaq_private.account_merge_resume_heads(receipt_id, canonical_account_id, unit_id, content_version, session_id, origin_account_id)
    values
      (prior_source_receipt, source_account, source_head_unit, source_head_version, current_source_final, source_account),
      (prior_canonical_receipt, canonical_account, source_head_unit, source_head_version, current_canonical_final, canonical_account);
  insert into kaq_private.account_merge_replay_heads(receipt_id, canonical_account_id, source_name, source_fingerprint, manifest_id, origin_account_id)
    values
      (prior_source_receipt, source_account, 'history-local-storage', repeat('a', 64), current_source_manifest, source_account),
      (prior_canonical_receipt, canonical_account, 'history-local-storage', repeat('a', 64), current_canonical_manifest, canonical_account),
      (prior_canonical_receipt, canonical_account, 'history-local-storage', repeat('f', 64), target_only_manifest, canonical_account);
  insert into public.exam_sessions(user_id, exam_id, start_hash, certification_id, source_version, question_order,
    legacy_import, position, state, submission_hash) values
    (canonical_account, collision_exam, decode(repeat('11', 32), 'hex'), 'saa-c03', 'collision-canonical',
      '[{"question_id":"merge-collision","question_revision":1}]'::jsonb, true, 0, 'submitted', decode(repeat('12', 32), 'hex')),
    (source_account, collision_exam, decode(repeat('11', 32), 'hex'), 'saa-c03', 'collision-source',
      '[{"question_id":"merge-collision","question_revision":1}]'::jsonb, true, 0, 'submitted', decode(repeat('12', 32), 'hex'));
  insert into public.exam_responses(user_id, exam_id, question_key, selected, flagged, duration_ms) values
    (canonical_account, collision_exam, '{"question_id":"merge-collision","question_revision":1}', '["A"]'::jsonb, false, 1),
    (source_account, collision_exam, '{"question_id":"merge-collision","question_revision":1}', '["B"]'::jsonb, false, 2);
  insert into public.learning_events(user_id, event_id, payload_hash, schema_version, certification_id, question_id,
    question_revision, source_version, category, mode, exam_id, answered_at, selected, correct, is_correct,
    duration_ms, attempt_number, prior_incorrect_count, reward) values
    (canonical_account, collision_event, decode(repeat('13', 32), 'hex'), 1, 'saa-c03', 'merge-collision', 1,
      'collision-canonical', 'security', 'exam', collision_exam, '2026-01-01T00:00:00Z', '["A"]'::jsonb,
      '["A"]'::jsonb, true, 1, 1, 0, 1),
    (source_account, collision_event, decode(repeat('13', 32), 'hex'), 1, 'saa-c03', 'merge-collision', 1,
      'collision-source', 'security', 'exam', collision_exam, '2026-01-01T00:00:00Z', '["B"]'::jsonb,
      '["A"]'::jsonb, false, 2, 1, 0, 0);
  insert into public.migration_items(user_id, manifest_id, source_row_id, exam_id, import_kind, payload_hash, outcome) values
    (canonical_account, canonical_manifest, 'merge-collision-exam', collision_exam, 'exam-session', decode(repeat('14', 32), 'hex'), 'accepted'),
    (source_account, source_manifest, 'merge-collision-exam', collision_exam, 'exam-session', decode(repeat('14', 32), 'hex'), 'accepted');
  select session_id, to_jsonb(final_session) into strict collision_final, fixture_row
    from public.fundamentals_final_sessions final_session
    where user_id = canonical_account and state = 'submitted' limit 1;
  fixture_row := jsonb_set(fixture_row, '{user_id}', to_jsonb(source_account));
  fixture_row := jsonb_set(fixture_row, '{is_active}', 'false'::jsonb);
  insert into public.fundamentals_final_sessions select * from jsonb_populate_record(null::public.fundamentals_final_sessions, fixture_row);
  select to_jsonb(event) into strict fixture_row from public.learning_events event
    where event.user_id = canonical_account and event.fundamentals_session_id = collision_final limit 1;
  fixture_row := jsonb_set(fixture_row, '{user_id}', to_jsonb(source_account));
  fixture_row := jsonb_set(fixture_row, '{event_id}', to_jsonb(collision_final_event));
  insert into public.learning_events select * from jsonb_populate_record(null::public.learning_events, fixture_row);
  select to_jsonb(final_session) into strict fixture_row from public.fundamentals_final_sessions final_session
    where user_id = source_account and state = 'draft' and is_active limit 1;
  fixture_row := jsonb_set(fixture_row, '{session_id}', to_jsonb(inactive_source_final));
  fixture_row := jsonb_set(fixture_row, '{is_active}', 'false'::jsonb);
  insert into public.fundamentals_final_sessions select * from jsonb_populate_record(null::public.fundamentals_final_sessions, fixture_row);
  insert into public.fundamentals_final_sessions(user_id, session_id, unit_id, content_version, catalog_hash, start_hash,
    question_order, required_score, is_active)
    select source_account, source_only_final, catalog.unit_id, catalog.content_version, catalog.content_hash,
      decode(repeat('15', 32), 'hex'), catalog.final_questions, ceil(jsonb_array_length(catalog.final_questions) * 0.8)::integer, true
    from public.published_fundamentals_catalogs catalog
    where not exists(select 1 from public.fundamentals_unit_progress progress
      where progress.user_id = source_account and progress.unit_id = catalog.unit_id and progress.content_version = catalog.content_version)
    order by catalog.unit_id, catalog.content_version limit 1
    returning unit_id, content_version into strict source_only_unit, source_only_version;
  insert into public.fundamentals_unit_progress(user_id, unit_id, content_version, active_final_session_id, revision)
    values(source_account, source_only_unit, source_only_version, source_only_final, 12);
  update public.dashboard_settings set revision = 10 where user_id = source_account;
  update public.roadmap_profiles set revision = 8 where user_id = source_account;
  -- SQL が正本の snapshot を、receipt 作成前のまま Node の projection 検証へ渡す。
  source_snapshot := kaq_private.capture_merge_snapshot_v2(array[source_account], null);
  target_snapshot := kaq_private.capture_merge_snapshot_v2(array[canonical_account], null);
  insert into data_engine_projection_snapshots(provenance, account_id, snapshot) values
    ('source', source_account, source_snapshot), ('target', canonical_account, target_snapshot);
  perform pg_temp.data_engine_assert('source_projection_binding',
    source_snapshot->'document'->'accounts' = jsonb_build_array(source_account)
    and source_snapshot->'document'->'lineage_accounts' @> jsonb_build_array(source_account));
  perform pg_temp.data_engine_assert('target_projection_binding',
    target_snapshot->'document'->'accounts' = jsonb_build_array(canonical_account)
    and target_snapshot->'document'->'lineage_accounts' @> jsonb_build_array(canonical_account));
  foreach table_key in array array[
    'public.assessment_answers', 'public.dashboard_settings', 'public.earned_certifications',
    'public.exam_responses', 'public.exam_sessions', 'public.fundamentals_final_sessions',
    'public.fundamentals_unit_progress', 'public.learning_events', 'public.learning_state',
    'public.migration_items', 'public.migration_manifests', 'public.roadmap_profiles',
    'kaq_private.learning_accounts', 'kaq_private.learning_memberships',
    'kaq_private.account_merge_receipts', 'kaq_private.account_merge_archives',
    'kaq_private.account_merge_id_maps', 'kaq_private.account_merge_resolution_choices',
    'kaq_private.account_merge_deferred_rows', 'kaq_private.account_merge_resume_heads',
    'kaq_private.account_merge_replay_heads', 'kaq_private.account_merge_lineage_closure'
  ] loop
    perform pg_temp.data_engine_assert('source_snapshot_count_' || table_key,
      jsonb_typeof(source_snapshot->'document'->'tables'->table_key) = 'array'
      and jsonb_array_length(source_snapshot->'document'->'tables'->table_key)
        = (source_snapshot->'fingerprints'->'tables'->table_key->>'count')::bigint);
    perform pg_temp.data_engine_assert('target_snapshot_count_' || table_key,
      jsonb_typeof(target_snapshot->'document'->'tables'->table_key) = 'array'
      and jsonb_array_length(target_snapshot->'document'->'tables'->table_key)
        = (target_snapshot->'fingerprints'->'tables'->table_key->>'count')::bigint);
    if table_key like 'public.%' then
      perform pg_temp.data_engine_assert('source_snapshot_nonempty_' || table_key,
        jsonb_array_length(source_snapshot->'document'->'tables'->table_key) > 0);
      perform pg_temp.data_engine_assert('target_snapshot_nonempty_' || table_key,
        jsonb_array_length(target_snapshot->'document'->'tables'->table_key) > 0);
    end if;
  end loop;
  perform pg_temp.data_engine_assert('projection_snapshots_preserved',
    (select count(*) from data_engine_projection_snapshots) = 2);
  -- The displayed preview exists before the receipt. Commit excludes that same receipt,
  -- so both sides bind the one v2 materialized snapshot rather than a partial digest.
  snapshot := kaq_private.capture_merge_snapshot_v2(array[source_account, canonical_account], null);
  digest := snapshot->>'digest';
  for choice_row in select value from jsonb_array_elements(snapshot->'document'->'tables'->'public.assessment_answers') loop
    if (choice_row->>'user_id')::uuid = source_account then
      choices := jsonb_set(choices, array['assessment', choice_row->>'assessment_id'], '"canonical"'::jsonb);
    end if;
  end loop;
  for choice_row in
    select jsonb_build_object('unit_id', value->>'unit_id', 'content_version', value->>'content_version')
    from jsonb_array_elements(snapshot->'document'->'tables'->'public.fundamentals_final_sessions')
    where (value->>'user_id')::uuid = source_account and value->>'state' = 'draft'
    group by value->>'unit_id', value->>'content_version'
  loop
    select value into strict selected_row from jsonb_array_elements(snapshot->'document'->'tables'->'public.fundamentals_final_sessions')
      where (value->>'user_id')::uuid = source_account and value->>'state' = 'draft'
        and value->>'unit_id' = choice_row->>'unit_id'
        and value->>'content_version' = choice_row->>'content_version'
        and coalesce((value->>'is_active')::boolean, true);
    choices := jsonb_set(choices, array['final_resume', (choice_row->>'unit_id') || ':' || (choice_row->>'content_version')],
      to_jsonb('source:' || (selected_row->>'session_id')));
  end loop;
  for choice_row in
    select jsonb_build_object('source_name', value->>'source_name', 'source_fingerprint', value->>'source_fingerprint')
    from jsonb_array_elements(snapshot->'document'->'tables'->'public.migration_manifests')
    where (value->>'user_id')::uuid = source_account
    group by value->>'source_name', value->>'source_fingerprint'
  loop
    select value into strict selected_row from jsonb_array_elements(snapshot->'document'->'tables'->'public.migration_manifests')
      where (value->>'user_id')::uuid = source_account
        and value->>'source_name' = choice_row->>'source_name'
        and value->>'source_fingerprint' = choice_row->>'source_fingerprint'
      order by ((value->>'manifest_id')::uuid = (select head.manifest_id
        from kaq_private.account_merge_replay_heads head where head.canonical_account_id = source_account
          and head.source_name = choice_row->>'source_name'
          and head.source_fingerprint = choice_row->>'source_fingerprint')) desc nulls last,
        value->>'manifest_id' limit 1;
    choices := jsonb_set(choices, array['manifest_head', (choice_row->>'source_name') || ':' || (choice_row->>'source_fingerprint')],
      to_jsonb('source:' || (selected_row->>'manifest_id')));
  end loop;
  insert into kaq_private.account_merge_receipts(
    id, intent_id, canonical_account_id, algorithm_version, consent_hash, before_scopes, choices, result
  ) values (
    receipt, current_intent,
    canonical_account, 2, decode(repeat('ab',32),'hex'), '[]', '{}'::jsonb, '{}'::jsonb
  );
  perform pg_temp.data_engine_assert('preview_digest_is_v2',
    snapshot->'document'->>'algorithm_version' = '2' and snapshot->'fingerprints'->>'algorithm_version' = '2');
  begin
    perform kaq_private.apply_merge_data_engine(receipt, source_account, canonical_account, repeat('0',64),
      (select generation from public.learning_state where user_id = canonical_account), choices);
    raise exception 'stale digest accepted';
  exception when sqlstate 'PT409' then null;
  end;
  insert into data_engine_checks values('stale_digest_rejected');
  perform kaq_private.apply_merge_data_engine(receipt, source_account, canonical_account, digest,
    (select generation from public.learning_state where user_id = canonical_account), choices);
  perform pg_temp.data_engine_assert('source_state_removed', not exists(select 1 from public.learning_state where user_id = source_account));
  foreach table_key in array array[
    'assessment_answers', 'dashboard_settings', 'earned_certifications', 'exam_responses',
    'exam_sessions', 'fundamentals_final_sessions', 'fundamentals_unit_progress',
    'learning_events', 'learning_state', 'migration_items', 'migration_manifests', 'roadmap_profiles'
  ] loop
    source_rows := snapshot->'document'->'tables'->('public.' || table_key);
    select count(*) into snapshot_count from jsonb_array_elements(source_rows);
    select count(*) into canonical_count from jsonb_array_elements(source_rows) source_row
      where (source_row.value->>'user_id')::uuid = canonical_account;
    select count(*) into archive_count
      from kaq_private.account_merge_archives archive
      where archive.receipt_id = receipt and archive.table_name = table_key;
    perform pg_temp.data_engine_assert('archived_count_' || table_key, archive_count = snapshot_count);
    perform pg_temp.data_engine_assert('archived_payloads_' || table_key, not exists(
      select 1 from jsonb_array_elements(source_rows) source_row
      where not exists(select 1 from kaq_private.account_merge_archives archive
        where archive.receipt_id = receipt and archive.table_name = table_key
          and archive.origin_account_id = (source_row.value->>'user_id')::uuid
          and archive.payload = source_row.value
          and archive.payload_hash = extensions.digest(source_row.value::text, 'sha256')
      )
    ));
    perform pg_temp.data_engine_assert('archived_origin_' || table_key, not exists(
      select 1 from kaq_private.account_merge_archives archive
      where archive.receipt_id = receipt and archive.table_name = table_key
        and archive.origin_account_id not in (source_account, canonical_account)
    ));
    execute format('select not exists(select 1 from public.%I where user_id = $1)', table_key)
      into source_gone using source_account;
    perform pg_temp.data_engine_assert('source_removed_' || table_key, source_gone);
    execute format('select count(*) from public.%I where user_id = $1', table_key)
      into current_canonical_count using canonical_account;
    perform pg_temp.data_engine_assert('canonical_count_not_lost_' || table_key,
      current_canonical_count >= canonical_count);
  end loop;
  select count(*) into map_count
    from unnest(array['learning_events', 'exam_sessions', 'fundamentals_final_sessions', 'migration_manifests']) source_table
    cross join lateral jsonb_array_elements(snapshot->'document'->'tables'->('public.' || source_table)) source_row
    where (source_row.value->>'user_id')::uuid = source_account;
  perform pg_temp.data_engine_assert('id_maps_preserved', (select count(*) from kaq_private.account_merge_id_maps
    where receipt_id = receipt and origin_account_id = source_account
      and entity_kind in ('event','exam','final','manifest')) = map_count);
  perform pg_temp.data_engine_assert('id_map_hashes_match_canonical_rows', not exists(
    select 1 from kaq_private.account_merge_id_maps id_map
    where id_map.receipt_id = receipt and id_map.origin_account_id = source_account
      and (
        not exists(
          select 1 from jsonb_each(snapshot->'document'->'tables') source_table
          cross join lateral jsonb_array_elements(source_table.value) source_row
          where source_table.key = case id_map.entity_kind
            when 'event' then 'public.learning_events'
            when 'exam' then 'public.exam_sessions'
            when 'final' then 'public.fundamentals_final_sessions'
            when 'manifest' then 'public.migration_manifests'
          end
            and (source_row.value->>'user_id')::uuid = source_account
            and (source_row.value->>case id_map.entity_kind
              when 'event' then 'event_id' when 'exam' then 'exam_id'
              when 'final' then 'session_id' else 'manifest_id' end)::uuid = id_map.original_id
            and id_map.original_row_hash = extensions.digest(source_row.value::text, 'sha256')
        )
        or id_map.canonical_row_hash is distinct from case id_map.entity_kind
          when 'event' then (select extensions.digest(to_jsonb(event)::text, 'sha256')
            from public.learning_events event where event.user_id = canonical_account and event.event_id = id_map.canonical_id)
          when 'exam' then (select extensions.digest(to_jsonb(exam)::text, 'sha256')
            from public.exam_sessions exam where exam.user_id = canonical_account and exam.exam_id = id_map.canonical_id)
          when 'final' then (select extensions.digest(to_jsonb(final_session)::text, 'sha256')
            from public.fundamentals_final_sessions final_session
            where final_session.user_id = canonical_account and final_session.session_id = id_map.canonical_id)
          when 'manifest' then (select extensions.digest(to_jsonb(manifest)::text, 'sha256')
            from public.migration_manifests manifest
            where manifest.user_id = canonical_account and manifest.manifest_id = id_map.canonical_id)
        end
      )
  ));
  perform pg_temp.data_engine_assert('foreign_keys_preserved',
    not exists(select 1 from public.exam_responses response left join public.exam_sessions session
      on session.user_id = response.user_id and session.exam_id = response.exam_id where session.exam_id is null)
    and not exists(select 1 from public.learning_events event left join public.exam_sessions session
      on session.user_id = event.user_id and session.exam_id = event.exam_id
      where event.exam_id is not null and session.exam_id is null)
    and not exists(select 1 from public.migration_items item left join public.migration_manifests manifest
      on manifest.user_id = item.user_id and manifest.manifest_id = item.manifest_id where manifest.manifest_id is null)
    and not exists(select 1 from public.migration_items item left join public.exam_sessions session
      on session.user_id = item.user_id and session.exam_id = item.exam_id
      where item.exam_id is not null and session.exam_id is null)
    and not exists(select 1 from public.fundamentals_unit_progress progress left join public.fundamentals_final_sessions active
      on active.user_id = progress.user_id and active.session_id = progress.active_final_session_id
      where progress.active_final_session_id is not null and (active.session_id is null or not active.is_active))
    and not exists(select 1 from public.fundamentals_unit_progress progress left join public.fundamentals_final_sessions passed
      on passed.user_id = progress.user_id and passed.session_id = progress.passed_final_session_id
      where progress.passed_final_session_id is not null and passed.session_id is null)
  );
  perform pg_temp.data_engine_assert('heads_preserved', exists(select 1 from kaq_private.account_merge_resume_heads where receipt_id = receipt)
    and exists(select 1 from kaq_private.account_merge_replay_heads where receipt_id = receipt));
  perform pg_temp.data_engine_assert('repeated_current_heads_replaced_without_history_rewrite',
    not exists(select 1 from kaq_private.account_merge_resume_heads where canonical_account_id = source_account)
    and not exists(select 1 from kaq_private.account_merge_replay_heads where canonical_account_id = source_account)
    and exists(select 1 from kaq_private.account_merge_resume_heads where receipt_id = receipt
      and canonical_account_id = canonical_account and unit_id = source_head_unit and content_version = source_head_version)
    and exists(select 1 from kaq_private.account_merge_replay_heads where receipt_id = receipt
      and canonical_account_id = canonical_account and source_name = 'history-local-storage' and source_fingerprint = repeat('a', 64))
    and not exists(select 1 from kaq_private.account_merge_resume_heads where receipt_id = prior_canonical_receipt
      and unit_id = source_head_unit and content_version = source_head_version)
    and not exists(select 1 from kaq_private.account_merge_replay_heads where receipt_id = prior_canonical_receipt
      and source_name = 'history-local-storage' and source_fingerprint = repeat('a', 64))
    and exists(select 1 from kaq_private.account_merge_replay_heads where receipt_id = prior_canonical_receipt
      and canonical_account_id = canonical_account and source_name = 'history-local-storage'
      and source_fingerprint = repeat('f', 64) and manifest_id = target_only_manifest)
    and (select count(*) from kaq_private.account_merge_id_maps where receipt_id = prior_source_receipt
      and origin_account_id = prior_source_origin and entity_kind in ('final', 'manifest')) = 2
    and (select count(*) from kaq_private.account_merge_id_maps where receipt_id = prior_canonical_receipt
      and origin_account_id = prior_canonical_origin and entity_kind in ('final', 'manifest')) = 2
    and exists(select 1 from kaq_private.account_merge_id_maps where receipt_id = prior_source_receipt
      and origin_account_id = prior_source_origin and entity_kind = 'final'
      and original_id = prior_source_final_original and canonical_id = source_head_final)
    and exists(select 1 from kaq_private.account_merge_id_maps where receipt_id = prior_source_receipt
      and origin_account_id = prior_source_origin and entity_kind = 'manifest'
      and original_id = prior_source_manifest_original and canonical_id = source_manifest)
    and exists(select 1 from kaq_private.account_merge_id_maps where receipt_id = prior_canonical_receipt
      and origin_account_id = prior_canonical_origin and entity_kind = 'final'
      and original_id = prior_canonical_final_original and canonical_id = canonical_head_final)
    and exists(select 1 from kaq_private.account_merge_id_maps where receipt_id = prior_canonical_receipt
      and origin_account_id = prior_canonical_origin and entity_kind = 'manifest'
      and original_id = prior_canonical_manifest_original and canonical_id = canonical_manifest)
    and exists(select 1 from kaq_private.account_merge_id_maps where receipt_id = receipt
      and origin_account_id = source_account and entity_kind = 'final' and original_id = current_source_final)
    and exists(select 1 from kaq_private.account_merge_id_maps where receipt_id = receipt
      and origin_account_id = source_account and entity_kind = 'manifest' and original_id = current_source_manifest)
    and (select historic.choices from kaq_private.account_merge_receipts historic where historic.id = prior_source_receipt) = prior_source_choices
    and (select historic.choices from kaq_private.account_merge_receipts historic where historic.id = prior_canonical_receipt) = prior_canonical_choices
  );
  perform pg_temp.data_engine_assert('final_heads_use_selected_original', not exists(
    select 1 from jsonb_each_text(choices->'final_resume') choice
    left join kaq_private.account_merge_resume_heads head on head.receipt_id = receipt
      and head.unit_id = split_part(choice.key, ':', 1) and head.content_version = split_part(choice.key, ':', 2)
    left join kaq_private.account_merge_id_maps id_map on id_map.receipt_id = receipt
      and id_map.origin_account_id = source_account and id_map.entity_kind = 'final'
      and id_map.original_id = split_part(choice.value, ':', 2)::uuid
    where head.session_id is distinct from case when split_part(choice.value, ':', 1) = 'source'
      then id_map.canonical_id else split_part(choice.value, ':', 2)::uuid end
  ));
  perform pg_temp.data_engine_assert('manifest_heads_use_selected_original', not exists(
    select 1 from jsonb_each_text(choices->'manifest_head') choice
    left join kaq_private.account_merge_replay_heads head on head.receipt_id = receipt
      and head.source_name = split_part(choice.key, ':', 1) and head.source_fingerprint = split_part(choice.key, ':', 2)
    left join kaq_private.account_merge_id_maps id_map on id_map.receipt_id = receipt
      and id_map.origin_account_id = source_account and id_map.entity_kind = 'manifest'
      and id_map.original_id = split_part(choice.value, ':', 2)::uuid
    where head.manifest_id is distinct from case when split_part(choice.value, ':', 1) = 'source'
      then id_map.canonical_id else split_part(choice.value, ':', 2)::uuid end
  ));
  perform pg_temp.data_engine_assert('non_equivalent_guest_exam_remapped', exists(
    select 1 from kaq_private.account_merge_id_maps id_map
    where id_map.receipt_id = receipt and id_map.origin_account_id = source_account and id_map.entity_kind = 'exam'
      and id_map.original_id = collision_exam and id_map.canonical_id <> collision_exam
  ) and exists(select 1 from public.exam_responses response
    join kaq_private.account_merge_id_maps id_map on id_map.receipt_id = receipt and id_map.entity_kind = 'exam'
      and id_map.original_id = collision_exam and response.exam_id = id_map.canonical_id
    where response.user_id = canonical_account and response.selected = '["B"]'::jsonb)
    and exists(select 1 from public.exam_responses response where response.user_id = canonical_account
      and response.exam_id = collision_exam and response.selected = '["A"]'::jsonb));
  perform pg_temp.data_engine_assert('non_equivalent_guest_event_remapped', exists(
    select 1 from kaq_private.account_merge_id_maps id_map
    where id_map.receipt_id = receipt and id_map.origin_account_id = source_account and id_map.entity_kind = 'event'
      and id_map.original_id = collision_event and id_map.canonical_id <> collision_event
  ));
  perform pg_temp.data_engine_assert('final_id_collision_remapped', exists(
    select 1 from kaq_private.account_merge_id_maps id_map
    where id_map.receipt_id = receipt and id_map.origin_account_id = source_account and id_map.entity_kind = 'final'
      and id_map.original_id = collision_final and id_map.canonical_id <> collision_final
  ));
  perform pg_temp.data_engine_assert('submitted_final_event_context_and_hashes_remapped', exists(
    select 1 from kaq_private.account_merge_id_maps final_map
    join kaq_private.account_merge_id_maps event_map on event_map.receipt_id = receipt and event_map.origin_account_id = source_account
      and event_map.entity_kind = 'event' and event_map.original_id = collision_final_event
    join public.fundamentals_final_sessions final_session on final_session.user_id = canonical_account
      and final_session.session_id = final_map.canonical_id
    join public.learning_events event on event.user_id = canonical_account and event.event_id = event_map.canonical_id
    where final_map.receipt_id = receipt and final_map.origin_account_id = source_account and final_map.entity_kind = 'final'
      and final_map.original_id = collision_final and final_map.canonical_id <> collision_final
      and final_session.state = 'submitted' and not final_session.is_active
      and final_map.canonical_row_hash = extensions.digest(to_jsonb(final_session)::text, 'sha256')
      and event.fundamentals_session_id = final_map.canonical_id
      and event.learning_context->>'sessionId' = final_map.canonical_id::text
      and event_map.canonical_row_hash = extensions.digest(to_jsonb(event)::text, 'sha256')
      and exists(select 1 from kaq_private.account_merge_archives final_archive where final_archive.receipt_id = receipt
        and final_archive.origin_account_id = source_account and final_archive.table_name = 'fundamentals_final_sessions'
        and final_archive.payload->>'session_id' = collision_final::text
        and final_archive.payload_hash = extensions.digest(final_archive.payload::text, 'sha256')
        and final_map.original_row_hash = final_archive.payload_hash)
      and exists(select 1 from kaq_private.account_merge_archives event_archive where event_archive.receipt_id = receipt
        and event_archive.origin_account_id = source_account and event_archive.table_name = 'learning_events'
        and event_archive.payload->>'event_id' = collision_final_event::text
        and event_archive.payload->>'fundamentals_session_id' = collision_final::text
        and event_archive.payload->'learning_context'->>'sessionId' = collision_final::text
        and event_archive.payload_hash = extensions.digest(event_archive.payload::text, 'sha256')
        and event_map.original_row_hash = event_archive.payload_hash)
  ));
  perform pg_temp.data_engine_assert('source_only_progress_uses_selected_active_final', exists(
    select 1 from public.fundamentals_unit_progress progress
    join kaq_private.account_merge_id_maps id_map on id_map.receipt_id = receipt and id_map.origin_account_id = source_account
      and id_map.entity_kind = 'final' and id_map.original_id = source_only_final
    join public.fundamentals_final_sessions final_session on final_session.user_id = canonical_account
      and final_session.session_id = id_map.canonical_id and final_session.is_active
    where progress.user_id = canonical_account and progress.unit_id = source_only_unit
      and progress.content_version = source_only_version and progress.active_final_session_id = id_map.canonical_id
      and progress.resume_stage = 'final' and progress.revision = 13
  ));
  perform pg_temp.data_engine_assert('selected_final_map_hash_matches_actual_row', exists(
    select 1 from kaq_private.account_merge_id_maps id_map
    join kaq_private.account_merge_resume_heads head on head.receipt_id = receipt
      and head.canonical_account_id = canonical_account and head.session_id = id_map.canonical_id
      and head.unit_id = source_only_unit and head.content_version = source_only_version
    join public.fundamentals_final_sessions final_session on final_session.user_id = canonical_account
      and final_session.session_id = id_map.canonical_id
    where id_map.receipt_id = receipt and id_map.origin_account_id = source_account
      and id_map.entity_kind = 'final' and id_map.original_id = source_only_final
      and final_session.state = 'draft' and final_session.is_active
      and id_map.canonical_row_hash = extensions.digest(to_jsonb(final_session)::text, 'sha256')
  ));
  perform pg_temp.data_engine_assert('source_revision_wins_before_increment',
    (select revision from public.dashboard_settings where user_id = canonical_account) > 10
    and (select revision from public.roadmap_profiles where user_id = canonical_account) > 8);
  perform pg_temp.data_engine_assert('all_raw_payload_hashes_retained', not exists(
    select 1 from jsonb_each(snapshot->'document'->'tables') table_rows
    cross join lateral jsonb_array_elements(table_rows.value) source_row
    where table_rows.key like 'public.%' and not exists(
      select 1 from kaq_private.account_merge_archives archive
      where archive.receipt_id = receipt and archive.table_name = substr(table_rows.key, 8)
        and archive.origin_account_id = (source_row.value->>'user_id')::uuid
        and archive.payload_hash = extensions.digest(source_row.value::text, 'sha256')
        and archive.payload = source_row.value
    )
  ));
end $$;
select json_build_object(
  'status', 'source-ready',
  'checks', json_agg(name order by name),
  'projection_snapshots', (
    select jsonb_object_agg(
      provenance,
      jsonb_build_object('account_id', account_id, 'snapshot', snapshot)
      order by provenance
    )
    from data_engine_projection_snapshots
  )
) from data_engine_checks;
