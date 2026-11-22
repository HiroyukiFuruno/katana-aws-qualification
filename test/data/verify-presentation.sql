begin;
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub', :'user_a', 'role', 'authenticated')::text, true);
select public.initialize_learning_state();

do $$
declare snapshot record; v_revision bigint;
begin
  select public.replace_roadmap_profile_v2(
    jsonb_build_array('saa-c03'), jsonb_build_object('assessment-1', 1), 0, 0,
    jsonb_build_object('optionOrders', jsonb_build_object('assessment-1', jsonb_build_array(2, 0, 3, 1)),
      'order', jsonb_build_array('assessment-1'))
  ) into v_revision;
  if v_revision <> 1 then raise exception 'v2 profile replacement did not advance revision'; end if;
  select * into snapshot from public.load_roadmap_profile_snapshot_v2();
  if snapshot.presentation <> jsonb_build_object(
    'optionOrders', jsonb_build_object('assessment-1', jsonb_build_array(2, 0, 3, 1)),
    'order', jsonb_build_array('assessment-1')
  ) or snapshot.revision <> 1 then
    raise exception 'v2 profile snapshot did not preserve presentation atomically';
  end if;
  begin
    perform public.replace_roadmap_profile_v2(
      jsonb_build_array('saa-c03'), jsonb_build_object('assessment-1', 1), 0, 1,
      jsonb_build_object('optionOrders', jsonb_build_object('assessment-1', jsonb_build_array(0, 0)),
        'order', jsonb_build_array('assessment-1'))
    );
    raise exception 'duplicate profile option index unexpectedly accepted';
  exception when invalid_parameter_value then null;
  end;
  select * into snapshot from public.load_roadmap_profile_snapshot_v2();
  if snapshot.revision <> 1 then raise exception 'invalid v2 profile changed saved state'; end if;
end $$;

select public.start_exam_session_v2(
  '80000000-0000-0000-0000-000000000001', 'saa-c03', 'presentation-v1',
  jsonb_build_array(jsonb_build_object('question_id', 'presentation-q', 'question_revision', 1)), 60000, 0,
  jsonb_build_object('choiceOrders', jsonb_build_object('["presentation-q",1]', jsonb_build_array('C', 'A', 'B')))
);
do $$
begin
  if (select presentation from public.exam_sessions where exam_id = '80000000-0000-0000-0000-000000000001')
    <> jsonb_build_object('choiceOrders', jsonb_build_object('["presentation-q",1]', jsonb_build_array('C', 'A', 'B')))
    or (select question_order from public.exam_sessions where exam_id = '80000000-0000-0000-0000-000000000001')
      <> jsonb_build_array(jsonb_build_object('question_id', 'presentation-q', 'question_revision', 1)) then
    raise exception 'exam presentation changed the canonical question reference';
  end if;
  perform public.start_exam_session_v2(
    '80000000-0000-0000-0000-000000000001', 'saa-c03', 'presentation-v1',
    jsonb_build_array(jsonb_build_object('question_id', 'presentation-q', 'question_revision', 1)), 60000, 0,
    jsonb_build_object('choiceOrders', jsonb_build_object('["presentation-q",1]', jsonb_build_array('C', 'A', 'B')))
  );
  begin
    perform public.start_exam_session_v2(
      '80000000-0000-0000-0000-000000000001', 'saa-c03', 'presentation-v1',
      jsonb_build_array(jsonb_build_object('question_id', 'presentation-q', 'question_revision', 1)), 60000, 0,
      jsonb_build_object('choiceOrders', jsonb_build_object('["presentation-q",1]', jsonb_build_array('A', 'B', 'C')))
    );
    raise exception 'exam retry overwrote its presentation';
  exception when unique_violation then null;
  end;
  begin
    perform public.start_exam_session_v2(
      '80000000-0000-0000-0000-000000000002', 'saa-c03', 'presentation-v1',
      jsonb_build_array(jsonb_build_object('question_id', 'presentation-q', 'question_revision', 1)), 60000, 0,
      jsonb_build_object('choiceOrders', jsonb_build_object('["presentation-q",1]', jsonb_build_array('A', 'A')))
    );
    raise exception 'duplicate choice identifier unexpectedly accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.start_exam_session_v2(
      '80000000-0000-0000-0000-000000000004', 'saa-c03', 'presentation-v1',
      jsonb_build_array(jsonb_build_object('question_id', 'presentation-q', 'question_revision', 1)), 60000, 0,
      jsonb_build_object('choiceOrders', jsonb_build_object('["other-q",1]', jsonb_build_array('A', 'B')))
    );
    raise exception 'unknown presentation question unexpectedly accepted';
  exception when invalid_parameter_value then null;
  end;
end $$;

select public.begin_migration(0, '80000000-0000-0000-0000-000000000003', 'profile-local-storage', 1, repeat('8', 64), 1);
do $$
declare first_revision bigint; retry_revision bigint; snapshot record;
begin
  select public.import_roadmap_profile_v2(
    0, '80000000-0000-0000-0000-000000000003', 'profile', 1,
    jsonb_build_array('imported-cert'), jsonb_build_object('imported-assessment', 2),
    jsonb_build_object('optionOrders', jsonb_build_object('imported-assessment', jsonb_build_array(1, 0, 2)),
      'order', jsonb_build_array('imported-assessment'))
  ) into first_revision;
  if first_revision <> 2 then raise exception 'v2 profile import did not advance revision'; end if;
  perform public.replace_roadmap_profile_v2(
    jsonb_build_array('live-cert'), jsonb_build_object('live-assessment', 3), 0, 2,
    jsonb_build_object('optionOrders', jsonb_build_object('live-assessment', jsonb_build_array(0, 1, 2)),
      'order', jsonb_build_array('live-assessment'))
  );
  select public.import_roadmap_profile_v2(
    0, '80000000-0000-0000-0000-000000000003', 'profile', 1,
    jsonb_build_array('imported-cert'), jsonb_build_object('imported-assessment', 2),
    jsonb_build_object('optionOrders', jsonb_build_object('imported-assessment', jsonb_build_array(1, 0, 2)),
      'order', jsonb_build_array('imported-assessment'))
  ) into retry_revision;
  select * into snapshot from public.load_roadmap_profile_snapshot_v2();
  if retry_revision <> 3 or snapshot.earned <> jsonb_build_array('live-cert')
    or snapshot.presentation->'order' <> jsonb_build_array('live-assessment') then
    raise exception 'idempotent profile import overwrote a newer profile';
  end if;
end $$;

set local role anon;
do $$
begin
  perform public.load_roadmap_profile_snapshot_v2();
  raise exception 'anon presentation snapshot unexpectedly permitted';
exception when insufficient_privilege then null;
end $$;
rollback;
