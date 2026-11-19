begin;
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub', :'user_a', 'role', 'authenticated')::text, true);
select public.initialize_learning_state();

do $$
begin
  insert into public.learning_events (user_id, event_id) values ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000099');
  raise exception 'direct event write unexpectedly permitted';
exception when insufficient_privilege then null;
end $$;

select public.append_learning_event(jsonb_build_object(
  'event_id', '10000000-0000-0000-0000-000000000001', 'schema_version', 1,
  'certification_id', 'saa-c03', 'question_id', 'event-1', 'question_revision', 1,
  'source_version', '2026-11', 'category', 'security', 'mode', 'study',
  'answered_at', '2026-01-01T15:00:00Z', 'selected', jsonb_build_array('A'), 'correct', jsonb_build_array('A'),
  'is_correct', true, 'duration_ms', 10, 'attempt_number', 1, 'prior_incorrect_count', 0, 'reward', 1
), 0);
select public.append_learning_event(jsonb_build_object(
  'event_id', '10000000-0000-0000-0000-000000000001', 'schema_version', 1,
  'certification_id', 'saa-c03', 'question_id', 'event-1', 'question_revision', 1,
  'source_version', '2026-11', 'category', 'security', 'mode', 'study',
  'answered_at', '2026-01-01T15:00:00Z', 'selected', jsonb_build_array('A'), 'correct', jsonb_build_array('A'),
  'is_correct', true, 'duration_ms', 10, 'attempt_number', 1, 'prior_incorrect_count', 0, 'reward', 1
), 0);
do $$
begin
  perform public.append_learning_event(jsonb_build_object(
    'event_id', '10000000-0000-0000-0000-000000000001', 'schema_version', 1,
    'certification_id', 'saa-c03', 'question_id', 'event-1', 'question_revision', 1,
    'source_version', '2026-11', 'category', 'security', 'mode', 'study',
    'answered_at', '2026-01-01T15:00:00Z', 'selected', jsonb_build_array('A'), 'correct', jsonb_build_array('A'),
    'is_correct', true, 'duration_ms', 11, 'attempt_number', 1, 'prior_incorrect_count', 0, 'reward', 1
  ), 0);
  raise exception 'event collision unexpectedly permitted';
exception when unique_violation then null;
end $$;

select public.replace_roadmap_profile(jsonb_build_array('saa-c03'), jsonb_build_object('assessment-1', 1), 0, 0);
do $$
begin
  perform public.replace_roadmap_profile('[]', '{}', 0, 0);
  raise exception 'stale profile unexpectedly permitted';
exception when serialization_failure then null;
end $$;

select public.start_exam_session('20000000-0000-0000-0000-000000000001', 'saa-c03', '2026-11',
  jsonb_build_array(jsonb_build_object('question_id', 'exam-1', 'question_revision', 1)), 60000, 0);
reset role;
update public.exam_sessions set started_at = clock_timestamp() - interval '2 seconds', deadline_at = clock_timestamp() - interval '1 second'
  where exam_id = '20000000-0000-0000-0000-000000000001';
set local role authenticated;
do $$
begin
  perform public.save_exam_response('20000000-0000-0000-0000-000000000001', 0, 0, 0,
    jsonb_build_object('question_id', 'exam-1', 'question_revision', 1), '[]', false, 0, null);
  raise exception 'expired exam save unexpectedly permitted';
exception when invalid_parameter_value then null;
end $$;

select public.start_exam_session('20000000-0000-0000-0000-000000000002', 'saa-c03', '2026-11',
  jsonb_build_array(jsonb_build_object('question_id', 'exam-1', 'question_revision', 1)), 60000, 0);
select public.save_exam_response('20000000-0000-0000-0000-000000000002', 0, 0, 0,
  jsonb_build_object('question_id', 'exam-1', 'question_revision', 1), jsonb_build_array('A'), false, 10, clock_timestamp());
do $$
begin
  perform public.save_exam_response('20000000-0000-0000-0000-000000000002', 0, null, 0,
    jsonb_build_object('question_id', 'exam-1', 'question_revision', 1), jsonb_build_array('A'), false, 10, clock_timestamp());
  raise exception 'null expected exam revision unexpectedly permitted';
exception when serialization_failure then null;
end $$;
do $$
declare submission jsonb := jsonb_build_array(jsonb_build_object(
  'event_id', '10000000-0000-0000-0000-000000000002', 'schema_version', 1,
  'certification_id', 'saa-c03', 'question_id', 'exam-1', 'question_revision', 1, 'source_version', 'question-2026-10',
  'category', 'security', 'mode', 'exam', 'exam_id', '20000000-0000-0000-0000-000000000002',
  'answered_at', clock_timestamp(), 'selected', jsonb_build_array('A'), 'correct', jsonb_build_array('A'),
  'is_correct', true, 'duration_ms', 10, 'attempt_number', 1, 'prior_incorrect_count', 0, 'reward', 1
)); first_submission timestamptz; retry_submission timestamptz;
begin
  begin
    perform public.finalize_exam_session('20000000-0000-0000-0000-000000000002', 0, null, submission);
    raise exception 'null expected finalization revision unexpectedly permitted';
  exception when serialization_failure then null;
  end;
  select public.finalize_exam_session('20000000-0000-0000-0000-000000000002', 0, 1, submission) into first_submission;
  select public.finalize_exam_session('20000000-0000-0000-0000-000000000002', 0, 1, submission) into retry_submission;
  if first_submission is distinct from retry_submission then raise exception 'identical submission was not idempotent'; end if;
  begin
    perform public.finalize_exam_session('20000000-0000-0000-0000-000000000002', 0, 1, jsonb_set(submission, '{0,duration_ms}', '11'));
    raise exception 'changed exam submission unexpectedly permitted';
  exception when unique_violation then null;
  end;
end $$;

select public.begin_migration(0, '30000000-0000-0000-0000-000000000001', 'profile-local-storage', 1, repeat('a', 64), 2);
select public.accept_migration_row(0, '30000000-0000-0000-0000-000000000001', 'profile');
select public.reject_migration_row(0, '30000000-0000-0000-0000-000000000001', 'corrupt', 'invalid-json');
select public.complete_migration(0, '30000000-0000-0000-0000-000000000001');
select public.complete_migration(0, '30000000-0000-0000-0000-000000000001');

select public.begin_migration(0, '30000000-0000-0000-0000-000000000002', 'exam-draft-local-storage', 1, repeat('b', 64), 1);
select public.import_exam_session(0, '30000000-0000-0000-0000-000000000002', 'draft-1', jsonb_build_object(
  'exam_id', '20000000-0000-0000-0000-000000000003', 'certification_id', 'saa-c03', 'source_version', '2026-11',
  'question_order', jsonb_build_array(jsonb_build_object('question_id', 'draft-1', 'question_revision', 1)),
  'started_at', clock_timestamp() - interval '10 minutes', 'deadline_at', clock_timestamp() + interval '10 minutes',
  'position', 0, 'state', 'draft'
), jsonb_build_array(jsonb_build_object(
  'question_ref', jsonb_build_object('question_id', 'draft-1', 'question_revision', 1),
  'selected', jsonb_build_array('A'), 'flagged', false, 'duration_ms', 10
)), '[]');
do $$
begin
  if (select deadline_at <= clock_timestamp() from public.exam_sessions where exam_id = '20000000-0000-0000-0000-000000000003') then
    raise exception 'valid imported draft deadline was not preserved';
  end if;
end $$;

select public.append_learning_event(jsonb_build_object(
  'event_id', '10000000-0000-0000-0000-000000000020', 'schema_version', 1,
  'certification_id', 'saa-c03', 'question_id', 'weighted-study', 'question_revision', 2,
  'source_version', '2026-11', 'category', 'security', 'mode', 'study',
  'answered_at', '2026-01-02T14:59:59Z', 'selected', jsonb_build_array('B'), 'correct', jsonb_build_array('A'),
  'is_correct', false, 'duration_ms', 20, 'attempt_number', 1, 'prior_incorrect_count', 0, 'reward', 0
), 0);
select public.append_learning_event(jsonb_build_object(
  'event_id', '10000000-0000-0000-0000-000000000021', 'schema_version', 1,
  'certification_id', 'fundamentals', 'question_id', 'weighted-review', 'question_revision', 1,
  'source_version', '2026-11', 'category', 'fundamentals', 'mode', 'review',
  'answered_at', '2026-01-01T15:00:00Z', 'selected', jsonb_build_array('A'), 'correct', jsonb_build_array('A'),
  'is_correct', true, 'duration_ms', 30, 'attempt_number', 1, 'prior_incorrect_count', 0, 'review_correct', true, 'reward', 1
), 0);
select public.append_learning_event(jsonb_build_object(
  'event_id', '10000000-0000-0000-0000-000000000022', 'schema_version', 1,
  'certification_id', 'saa-c03', 'question_id', 'upper-exclusive', 'question_revision', 1,
  'source_version', '2026-11', 'category', 'security', 'mode', 'study',
  'answered_at', '2026-01-02T15:00:00Z', 'selected', jsonb_build_array('A'), 'correct', jsonb_build_array('A'),
  'is_correct', true, 'duration_ms', 40, 'attempt_number', 1, 'prior_incorrect_count', 0, 'reward', 1
), 0);

do $$
declare summary jsonb;
begin
  select public.learning_summary('2026-01-01T15:00:00Z', '2026-01-02T15:00:00Z', array['study'], 'Asia/Tokyo') into summary;
  if summary #>> '{total,answered}' <> '2' or summary #>> '{total,accuracy}' <> '0.50000000000000000000'
    or summary #>> '{daily,0,date}' <> '2026-01-02' then
    raise exception 'summary timezone or denominator is wrong: %', summary;
  end if;
  select public.learning_summary('2026-01-01T15:00:00Z', '2026-01-02T15:00:00Z', array['study', 'review'], 'Asia/Tokyo') into summary;
  if summary #>> '{total,answered}' <> '3' or summary #>> '{total,correct}' <> '2' then
    raise exception 'summary mode denominator is wrong: %', summary;
  end if;
  select public.learning_summary('2026-01-01T15:00:00Z', '2026-01-02T15:00:00Z', array['study', 'review'], 'Asia/Tokyo', 'fundamentals') into summary;
  if summary #>> '{total,answered}' <> '1' or summary #>> '{total,correct}' <> '1' then
    raise exception 'summary certification filter is wrong: %', summary;
  end if;
  select public.learning_summary('2026-02-01T00:00:00Z', '2026-02-02T00:00:00Z', array['study'], 'UTC') into summary;
  if summary #>> '{total,accuracy}' is not null or summary #>> '{total,meanDurationMs}' is not null then
    raise exception 'zero summary must be null: %', summary;
  end if;
end $$;

do $$
declare table_name text;
begin
  foreach table_name in array array['learning_state', 'learning_events', 'exam_sessions', 'exam_responses',
    'earned_certifications', 'assessment_answers', 'migration_manifests', 'migration_items', 'roadmap_profiles'] loop
    begin
      execute format('update public.%I set user_id = user_id where false', table_name);
      raise exception 'direct update unexpectedly permitted on %', table_name;
    exception when insufficient_privilege then null;
    end;
    begin
      execute format('delete from public.%I where false', table_name);
      raise exception 'direct delete unexpectedly permitted on %', table_name;
    exception when insufficient_privilege then null;
    end;
  end loop;
end $$;

select set_config('request.jwt.claims', jsonb_build_object('sub', :'user_b', 'role', 'authenticated')::text, true);
do $$
declare table_name text; v_exists boolean;
begin
  foreach table_name in array array['learning_state', 'learning_events', 'exam_sessions', 'exam_responses',
    'earned_certifications', 'assessment_answers', 'migration_manifests', 'migration_items', 'roadmap_profiles'] loop
    execute format('select exists (select 1 from public.%I)', table_name) into v_exists;
    if v_exists then raise exception 'cross-user RLS read from %', table_name; end if;
  end loop;
end $$;
select set_config('request.jwt.claims', jsonb_build_object('sub', :'user_a', 'role', 'authenticated')::text, true);
select public.reset_my_learning_data(0);
do $$
begin
  perform public.append_learning_event(jsonb_build_object(
    'event_id', '10000000-0000-0000-0000-000000000010', 'schema_version', 1,
    'certification_id', 'saa-c03', 'question_id', 'stale', 'question_revision', 1,
    'source_version', '2026-11', 'category', 'security', 'mode', 'study',
    'answered_at', '2026-01-01T15:00:00Z', 'selected', '[]', 'correct', '[]',
    'is_correct', false, 'duration_ms', 0, 'attempt_number', 1, 'prior_incorrect_count', 0, 'reward', 0
  ), 0);
  raise exception 'pre-reset generation unexpectedly permitted';
exception when SQLSTATE 'PT409' then null;
end $$;
set local role anon;
do $$
declare table_name text;
begin
  foreach table_name in array array['learning_state', 'learning_events', 'exam_sessions', 'exam_responses',
    'earned_certifications', 'assessment_answers', 'migration_manifests', 'migration_items', 'roadmap_profiles'] loop
    begin
      execute format('select 1 from public.%I limit 1', table_name);
      raise exception 'anon select unexpectedly permitted on %', table_name;
    exception when insufficient_privilege then null;
    end;
  end loop;
  perform public.append_learning_event('{}', 0);
  raise exception 'anon RPC unexpectedly permitted';
exception when insufficient_privilege then null;
end $$;
rollback;
