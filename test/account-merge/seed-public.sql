do $seed$
declare
  v_user_id uuid := '__SEED_USER_ID__';
  v_settings jsonb := '__DASHBOARD_SETTINGS__';
  v_generation bigint;
  v_manifest_id uuid;
  v_started_manifest_id uuid;
  v_exam_id uuid := gen_random_uuid();
  v_imported_exam_id uuid := gen_random_uuid();
  v_question jsonb := jsonb_build_object('question_id', 'migration-seed-exam', 'question_revision', 1);
  v_catalog public.published_fundamentals_catalogs%rowtype;
  v_catalog_digest bytea;
  v_latest_version text;
  v_old_version text;
  v_entry jsonb;
  v_snapshot jsonb;
  v_revision bigint := 0;
  v_final_session_id uuid;
  v_old_final_session_id uuid;
  v_final_order jsonb;
  v_final_question jsonb;
  v_final_position integer;
  v_final_revision bigint;
  v_table text;
  v_present boolean;
  v_phase text := 'catalog-inventory';
begin
  if (select count(*) from public.published_fundamentals_catalogs) <> 18 then
    raise exception 'expected the existing 18 catalogs';
  end if;
  select extensions.digest(jsonb_agg(to_jsonb(c) order by unit_id, content_version)::text, 'sha256')
    into v_catalog_digest from public.published_fundamentals_catalogs c;
  select * into strict v_catalog from public.published_fundamentals_catalogs
    where unit_id = 'fundamentals.cloud-concepts'
    order by published_at desc, content_version desc limit 1;
  v_latest_version := v_catalog.content_version;
  if (select count(*) from public.published_fundamentals_catalogs
    where unit_id = v_catalog.unit_id) <> 2 then
    raise exception 'expected two existing cloud concepts versions';
  end if;
  select content_version into strict v_old_version from public.published_fundamentals_catalogs
    where unit_id = v_catalog.unit_id and content_version <> v_latest_version;

  -- 既存RPCの入力検査を通す移行fixtureであり、SSO所有証明は代用しない。
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_user_id, 'role', 'authenticated'
  )::text, true);
  v_phase := 'learning-state';
  v_generation := public.initialize_learning_state();
  v_phase := 'completed-manifest';
  v_manifest_id := public.begin_migration(v_generation, gen_random_uuid(),
    'history-local-storage', 1, repeat('a', 64), 1);
  perform public.append_learning_event(jsonb_build_object(
    'event_id', gen_random_uuid(), 'schema_version', 1,
    'certification_id', 'saa-c03', 'question_id', 'migration-seed-study',
    'question_revision', 1, 'source_version', 'migration-fixture-v1', 'category', 'security',
    'mode', 'study', 'answered_at', '2026-01-01T15:00:00Z',
    'selected', jsonb_build_array('A'), 'correct', jsonb_build_array('A'),
    'is_correct', true, 'duration_ms', 25, 'attempt_number', 1,
    'prior_incorrect_count', 0, 'reward', 1
  ), v_generation, v_manifest_id, 'migration-seed-row');
  perform public.complete_migration(v_generation, v_manifest_id);
  v_phase := 'exam-draft';
  perform public.start_exam_session(v_exam_id, 'saa-c03', 'migration-fixture-v1',
    jsonb_build_array(v_question), 60000, v_generation);
  perform public.save_exam_response_confirmed(v_exam_id, v_generation, 0, 0, 0,
    v_question, jsonb_build_array('A'), true, 10, true);
  v_phase := 'exam-submitted-import';
  v_started_manifest_id := public.begin_migration(v_generation, gen_random_uuid(),
    'history-local-storage', 1, repeat('b', 64), 2);
  perform public.import_exam_session(v_generation, v_started_manifest_id,
    'migration-seed-submitted-exam', jsonb_build_object(
      'exam_id', v_imported_exam_id, 'certification_id', 'saa-c03',
      'source_version', 'migration-fixture-v1', 'question_order', jsonb_build_array(v_question),
      'legacy_import', true, 'state', 'submitted', 'position', 0,
      'started_at', null, 'deadline_at', null, 'submitted_at', null
    ), '[]'::jsonb, jsonb_build_array(jsonb_build_object(
      'event_id', gen_random_uuid(), 'schema_version', 1,
      'certification_id', 'saa-c03', 'question_id', 'migration-seed-exam',
      'question_revision', 1, 'source_version', 'migration-fixture-v1', 'category', 'security',
      'mode', 'exam', 'exam_id', v_imported_exam_id, 'answered_at', '2026-01-01T16:00:00Z',
      'selected', jsonb_build_array('A'), 'correct', jsonb_build_array('A'),
      'is_correct', true, 'duration_ms', 50, 'attempt_number', 1,
      'prior_incorrect_count', 0, 'reward', 1
    )));
  v_phase := 'roadmap-profile';
  perform public.replace_roadmap_profile(jsonb_build_array('saa-c03'),
    jsonb_build_object('migration-seed-assessment', 2), v_generation, 0);

  for v_catalog in select * from public.published_fundamentals_catalogs
    where unit_id = 'fundamentals.cloud-concepts'
    order by published_at desc, content_version desc
  loop
    v_phase := case when v_catalog.content_version = v_latest_version
      then 'latest-unit-steps' else 'legacy-unit-steps' end;
    v_revision := 0;
    for v_entry in select entry.value from jsonb_array_elements(v_catalog.plan) entry(value)
      where coalesce((entry.value->>'required')::boolean, false)
      order by (entry.value->>'position')::integer
    loop
      v_snapshot := public.record_fundamentals_step(
        v_catalog.unit_id, v_catalog.content_version, v_entry->>'kind', v_entry->>'id',
        case when v_entry->>'kind' = 'checkpoint' then v_entry->'question'->'correctChoiceIds' end,
        v_revision, v_generation, gen_random_uuid(), 10
      );
      v_revision := (v_snapshot->'progress'->>'revision')::bigint;
      if v_revision is null then raise exception 'missing seeded lesson revision'; end if;
    end loop;
    v_phase := case when v_catalog.content_version = v_latest_version
      then 'latest-final-draft' else 'legacy-final-start' end;
    v_final_session_id := gen_random_uuid();
    perform public.start_fundamentals_final(v_final_session_id, v_catalog.unit_id,
      v_catalog.content_version, v_revision, v_generation);
    if v_catalog.content_version = v_latest_version then continue; end if;

    v_phase := 'legacy-final-responses';
    v_old_final_session_id := v_final_session_id;
    select question_order into strict v_final_order from public.fundamentals_final_sessions
      where user_id = v_user_id and session_id = v_final_session_id;
    if jsonb_array_length(v_final_order) <> 12 then raise exception 'expected 12 final questions'; end if;
    for v_final_position in 0..jsonb_array_length(v_final_order) - 1 loop
      v_final_question := v_final_order->v_final_position;
      select revision into strict v_final_revision from public.fundamentals_final_sessions
        where user_id = v_user_id and session_id = v_final_session_id;
      perform public.save_fundamentals_final_response(v_final_session_id, v_final_revision,
        v_final_position, jsonb_build_object(
          'questionId', v_final_question->>'questionId',
          'revision', (v_final_question->>'revision')::integer,
          'sourceVersion', v_final_question->>'sourceVersion'
        ), v_final_question->'correctChoiceIds', v_generation, gen_random_uuid(), 20, v_final_position);
    end loop;
    v_phase := 'legacy-final-submit';
    select revision into strict v_final_revision from public.fundamentals_final_sessions
      where user_id = v_user_id and session_id = v_final_session_id;
    perform public.finalize_fundamentals_final(v_final_session_id, v_final_revision, v_generation);
  end loop;
  v_phase := 'dashboard-settings';
  perform public.save_dashboard_settings(v_settings, 0, v_generation);

  v_phase := 'fixture-exam-invariants';
  if not exists (select 1 from public.exam_sessions where user_id = v_user_id
      and exam_id = v_exam_id and state = 'draft' and not legacy_import)
    or not exists (select 1 from public.exam_responses where user_id = v_user_id and exam_id = v_exam_id)
    or not exists (select 1 from public.exam_sessions where user_id = v_user_id
      and exam_id = v_imported_exam_id and state = 'submitted' and legacy_import
      and started_at is null and deadline_at is null and submitted_at is null
      and submitted_received_at is null)
    or (select count(*) from public.learning_events where user_id = v_user_id
      and exam_id = v_imported_exam_id) <> 1 then
    raise exception 'expected independent draft and submitted legacy exams';
  end if;
  v_phase := 'fixture-manifest-invariants';
  if not exists (select 1 from public.migration_manifests where user_id = v_user_id
      and manifest_id = v_manifest_id and status = 'completed' and declared_rows = 1)
    or not exists (select 1 from public.migration_manifests where user_id = v_user_id
      and manifest_id = v_started_manifest_id and status = 'started'
      and declared_rows = 2 and completed_at is null)
    or (select count(*) from public.migration_items where user_id = v_user_id
      and manifest_id = v_started_manifest_id and outcome = 'accepted') <> 1
    or (select count(*) from public.migration_items where user_id = v_user_id
      and manifest_id = v_started_manifest_id) <> 1 then
    raise exception 'expected completed and partially accepted started manifests';
  end if;
  v_phase := 'fixture-lesson-invariants';
  if not exists (select 1 from public.fundamentals_final_sessions where user_id = v_user_id
      and unit_id = 'fundamentals.cloud-concepts' and content_version = v_latest_version
      and state = 'draft' and score is null and passed is null)
    or not exists (select 1 from public.fundamentals_final_sessions where user_id = v_user_id
      and session_id = v_old_final_session_id and content_version = v_old_version
      and content_version <> v_latest_version and state = 'submitted' and passed and score = 12
      and jsonb_array_length(question_order) = 12)
    or not exists (select 1 from public.fundamentals_unit_progress where user_id = v_user_id
      and unit_id = 'fundamentals.cloud-concepts' and content_version = v_old_version
      and passed_final_session_id = v_old_final_session_id and passed_at is not null)
    or not exists (select 1 from public.fundamentals_unit_progress where user_id = v_user_id
      and unit_id = 'fundamentals.cloud-concepts' and content_version = v_latest_version
      and active_final_session_id is not null and passed_final_session_id is null)
    or (select count(*) from public.learning_events where user_id = v_user_id
      and fundamentals_session_id = v_old_final_session_id and is_correct) <> 12
    or (select count(*) from public.learning_events where user_id = v_user_id
      and fundamentals_session_id = v_old_final_session_id) <> 12 then
    raise exception 'expected latest final draft and independent 12/12 legacy pass';
  end if;
  v_phase := 'owner-table-presence';
  foreach v_table in array array[
    'learning_state', 'learning_events', 'exam_sessions', 'exam_responses',
    'earned_certifications', 'assessment_answers', 'roadmap_profiles',
    'migration_manifests', 'migration_items', 'fundamentals_unit_progress',
    'fundamentals_final_sessions', 'dashboard_settings'
  ] loop
    execute format('select exists(select 1 from public.%I where user_id = $1)', v_table)
      into v_present using v_user_id;
    if not v_present then raise exception 'empty seeded owner table: %', v_table; end if;
  end loop;
  v_phase := 'catalog-integrity';
  if (select count(*) from public.published_fundamentals_catalogs) <> 18
    or v_catalog_digest is distinct from (
    select extensions.digest(jsonb_agg(to_jsonb(c) order by unit_id, content_version)::text, 'sha256')
    from public.published_fundamentals_catalogs c
  ) then raise exception 'the public seed changed existing catalogs'; end if;
exception when others then
  raise exception 'public seed transaction failed in % (SQLSTATE %)', v_phase, sqlstate using errcode = sqlstate;
end $seed$;
