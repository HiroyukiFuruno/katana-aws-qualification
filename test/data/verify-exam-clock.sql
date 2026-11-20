begin;
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub', :'user_a', 'role', 'authenticated')::text, true);
select public.initialize_learning_state();

do $$
declare
  v_clock timestamptz;
  v_first record;
  v_repeat record;
  v_second record;
  v_flag record;
  v_saved timestamptz;
begin
  select public.read_learning_clock(0) into v_clock;
  if v_clock is null then raise exception 'server learning clock was null'; end if;
  perform public.start_exam_session('20000000-0000-0000-0000-000000000006', 'saa-c03', '2026-11',
    jsonb_build_array(
      jsonb_build_object('question_id', 'clock-0', 'question_revision', 1),
      jsonb_build_object('question_id', 'clock-1', 'question_revision', 1)
    ), 60000, 0);
  select * into v_first from public.save_exam_response_confirmed(
    '20000000-0000-0000-0000-000000000006', 0, 0, 1, 0,
    jsonb_build_object('question_id', 'clock-0', 'question_revision', 1), jsonb_build_array('A'), false, 12, true
  );
  if v_first.revision <> 1 or v_first.selected_at is null or v_first.duration_ms <> 12
    or v_first.selected_at is distinct from (
      select selected_at from public.exam_responses
      where exam_id = '20000000-0000-0000-0000-000000000006'
        and question_key = jsonb_build_object('question_id', 'clock-0', 'question_revision', 1)::text
    ) or (select position from public.exam_sessions where exam_id = '20000000-0000-0000-0000-000000000006') <> 1 then
    raise exception 'confirmed response did not preserve its server timestamp or target cursor';
  end if;
  v_saved := v_first.selected_at;
  select * into v_repeat from public.save_exam_response_confirmed(
    '20000000-0000-0000-0000-000000000006', 0, 1, 1, 0,
    jsonb_build_object('question_id', 'clock-0', 'question_revision', 1), jsonb_build_array('A'), true, 12, true
  );
  if v_repeat.revision <> 2 or v_repeat.selected_at is distinct from v_saved then
    raise exception 'confirmed unchanged selection changed its original timestamp';
  end if;
  select * into v_second from public.save_exam_response_confirmed(
    '20000000-0000-0000-0000-000000000006', 0, 2, 1, 1,
    jsonb_build_object('question_id', 'clock-1', 'question_revision', 1), jsonb_build_array('B'), false, 9, true
  );
  if v_second.revision <> 3 or v_second.selected_at is null or v_second.duration_ms <> 9 then
    raise exception 'confirmed response did not save the second question';
  end if;
  select * into v_flag from public.save_exam_response_confirmed(
    '20000000-0000-0000-0000-000000000006', 0, 3, 1, 1,
    jsonb_build_object('question_id', 'clock-1', 'question_revision', 1), jsonb_build_array(), true, 0, false
  );
  if v_flag.revision <> 4 or v_flag.selected_at is not null or v_flag.duration_ms <> 0 then
    raise exception 'flag-only response did not remain unanswered';
  end if;
  begin
    perform public.save_exam_response_confirmed(
      '20000000-0000-0000-0000-000000000006', 0, 4, 1, 1,
      jsonb_build_object('question_id', 'clock-1', 'question_revision', 1), jsonb_build_array(), false, 0, null
    );
    raise exception 'null selection state unexpectedly permitted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.read_learning_clock(1);
    raise exception 'stale generation clock unexpectedly permitted';
  exception when SQLSTATE 'PT409' then null;
  end;
end $$;

select public.start_exam_session('20000000-0000-0000-0000-000000000007', 'saa-c03', '2026-11',
  jsonb_build_array(jsonb_build_object('question_id', 'clock-expired', 'question_revision', 1)), 60000, 0);
reset role;
update public.exam_sessions set started_at = clock_timestamp() - interval '2 seconds', deadline_at = clock_timestamp() - interval '1 second'
  where exam_id = '20000000-0000-0000-0000-000000000007';
set local role authenticated;
do $$
begin
  perform public.save_exam_response_confirmed(
    '20000000-0000-0000-0000-000000000007', 0, 0, 0, 0,
    jsonb_build_object('question_id', 'clock-expired', 'question_revision', 1), jsonb_build_array('A'), false, 1, true
  );
  raise exception 'expired confirmed response unexpectedly permitted';
exception when invalid_parameter_value then null;
end $$;

select set_config('request.jwt.claims', jsonb_build_object('sub', :'user_b', 'role', 'authenticated')::text, true);
select public.initialize_learning_state();
do $$
begin
  perform public.save_exam_response_confirmed(
    '20000000-0000-0000-0000-000000000006', 0, 4, 1, 1,
    jsonb_build_object('question_id', 'clock-1', 'question_revision', 1), jsonb_build_array('A'), false, 1, true
  );
  raise exception 'other user confirmed response unexpectedly permitted';
exception when invalid_parameter_value then null;
end $$;

set local role anon;
do $$
begin
  begin
    perform public.read_learning_clock(0);
    raise exception 'anon learning clock unexpectedly permitted';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.save_exam_response_confirmed(
      '20000000-0000-0000-0000-000000000006', 0, 4, 1, 1,
      jsonb_build_object('question_id', 'clock-1', 'question_revision', 1), jsonb_build_array('A'), false, 1, true
    );
    raise exception 'anon confirmed response unexpectedly permitted';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;
