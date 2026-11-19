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
reset role;
delete from auth.users where id = :'user_b';
do $$
begin
  if exists (select 1 from public.learning_state where user_id = (current_setting('request.jwt.claims')::jsonb ->> 'sub')::uuid)
    or exists (select 1 from public.learning_events where user_id = (current_setting('request.jwt.claims')::jsonb ->> 'sub')::uuid) then
    raise exception 'auth user deletion did not cascade learning data';
  end if;
end $$;
rollback;
