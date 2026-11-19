begin;
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub', :'user_b', 'role', 'authenticated')::text, true);
select public.initialize_learning_state();
select public.append_learning_event(jsonb_build_object(
  'event_id', '50000000-0000-0000-0000-000000000001', 'schema_version', 1,
  'certification_id', 'fundamentals', 'question_id', 'cascade-1', 'question_revision', 1,
  'source_version', '2026-11', 'category', 'fundamentals', 'mode', 'study',
  'answered_at', '2026-01-01T15:00:00Z', 'selected', jsonb_build_array('A'), 'correct', jsonb_build_array('A'),
  'is_correct', true, 'duration_ms', 10, 'attempt_number', 1, 'prior_incorrect_count', 0, 'reward', 1
), 0);
select public.start_exam_session('50000000-0000-0000-0000-000000000002', 'fundamentals', '2026-11',
  jsonb_build_array(jsonb_build_object('question_id', 'cascade-exam', 'question_revision', 1)), 60000, 0);
select public.save_exam_response('50000000-0000-0000-0000-000000000002', 0, 0, 0,
  jsonb_build_object('question_id', 'cascade-exam', 'question_revision', 1), jsonb_build_array('A'), true, 10, clock_timestamp());
select public.begin_migration(0, '50000000-0000-0000-0000-000000000003', 'profile-local-storage', 1, repeat('c', 64), 1);
select public.accept_migration_row(0, '50000000-0000-0000-0000-000000000003', 'cascade-profile');
select public.replace_roadmap_profile(jsonb_build_array('fundamentals'), jsonb_build_object('cascade-assessment', 1), 0, 0);
reset role;
delete from auth.users where id = :'user_b';
do $$
begin
  if exists (select 1 from public.learning_state where user_id = (current_setting('request.jwt.claims')::jsonb ->> 'sub')::uuid)
    or exists (select 1 from public.learning_events where user_id = (current_setting('request.jwt.claims')::jsonb ->> 'sub')::uuid)
    or exists (select 1 from public.exam_sessions where user_id = (current_setting('request.jwt.claims')::jsonb ->> 'sub')::uuid)
    or exists (select 1 from public.exam_responses where user_id = (current_setting('request.jwt.claims')::jsonb ->> 'sub')::uuid)
    or exists (select 1 from public.earned_certifications where user_id = (current_setting('request.jwt.claims')::jsonb ->> 'sub')::uuid)
    or exists (select 1 from public.assessment_answers where user_id = (current_setting('request.jwt.claims')::jsonb ->> 'sub')::uuid)
    or exists (select 1 from public.migration_manifests where user_id = (current_setting('request.jwt.claims')::jsonb ->> 'sub')::uuid)
    or exists (select 1 from public.migration_items where user_id = (current_setting('request.jwt.claims')::jsonb ->> 'sub')::uuid)
    or exists (select 1 from public.roadmap_profiles where user_id = (current_setting('request.jwt.claims')::jsonb ->> 'sub')::uuid) then
    raise exception 'auth user deletion did not cascade all learning data';
  end if;
end $$;
rollback;
