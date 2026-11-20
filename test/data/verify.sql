begin;
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub', :'user_a', 'role', 'authenticated')::text, true);
select public.initialize_learning_state();
select public.begin_migration(0, '30000000-0000-0000-0000-000000000009', 'wrong-index-local-storage', 1, repeat('9', 64), 0);
select public.complete_migration(0, '30000000-0000-0000-0000-000000000009');

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
declare snapshot record;
begin
  select * into snapshot from public.load_roadmap_profile_snapshot();
  if snapshot.earned <> jsonb_build_array('saa-c03') or snapshot.answers <> jsonb_build_object('assessment-1', 1)
    or snapshot.revision <> 1 then
    raise exception 'profile snapshot is not a consistent saved profile';
  end if;
end $$;
do $$
begin
  perform public.replace_roadmap_profile('[]', '{}', 0, 0);
  raise exception 'stale profile unexpectedly permitted';
exception when sqlstate 'PT412' then null;
end $$;
do $$
begin
  begin
    perform public.replace_roadmap_profile(null, jsonb_build_object('assessment-1', 1), 0, 1);
    raise exception 'null earned profile unexpectedly permitted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.replace_roadmap_profile(jsonb_build_array('saa-c03'), null, 0, 1);
    raise exception 'null answers profile unexpectedly permitted';
  exception when invalid_parameter_value then null;
  end;
  if not exists (select 1 from public.earned_certifications where certification_id = 'saa-c03')
    or not exists (select 1 from public.assessment_answers where assessment_id = 'assessment-1' and answer = 1)
    or (select revision from public.roadmap_profiles) <> 1 then
    raise exception 'null profile input changed saved profile';
  end if;
end $$;

select public.begin_migration(0, '30000000-0000-0000-0000-000000000003', 'profile-local-storage', 1, repeat('d', 64), 1);
do $$
declare imported_revision bigint; retried_revision bigint;
begin
  select public.import_roadmap_profile(0, '30000000-0000-0000-0000-000000000003', 'profile-import', 1,
    jsonb_build_array('imported-cert'), jsonb_build_object('imported-assessment', 2)) into imported_revision;
  if imported_revision <> 2 then raise exception 'profile import did not advance revision'; end if;
  perform public.replace_roadmap_profile(jsonb_build_array('realtime-cert'), jsonb_build_object('realtime-assessment', 3), 0, 2);
  select public.import_roadmap_profile(0, '30000000-0000-0000-0000-000000000003', 'profile-import', 1,
    jsonb_build_array('imported-cert'), jsonb_build_object('imported-assessment', 2)) into retried_revision;
  if retried_revision <> 3 then raise exception 'same-revision profile retry changed state'; end if;
  select public.import_roadmap_profile(0, '30000000-0000-0000-0000-000000000003', 'profile-import', 3,
    jsonb_build_array('imported-cert'), jsonb_build_object('imported-assessment', 2)) into retried_revision;
  if retried_revision <> 3 or not exists (
    select 1 from public.earned_certifications where certification_id = 'realtime-cert'
  ) or exists (select 1 from public.earned_certifications where certification_id = 'imported-cert') then
    raise exception 'profile import retry overwrote a realtime update';
  end if;
  begin
    perform public.import_roadmap_profile(0, '30000000-0000-0000-0000-000000000003', 'profile-import', 1,
      jsonb_build_array('different-cert'), jsonb_build_object('different-assessment', 4));
    raise exception 'profile migration row accepted a different payload';
  exception when unique_violation then null;
  end;
end $$;
select public.begin_migration(0, '30000000-0000-0000-0000-000000000004', 'profile-local-storage', 1, repeat('e', 64), 1);
do $$
begin
  begin
    perform public.import_roadmap_profile(0, '30000000-0000-0000-0000-000000000004', 'profile-failure', 0,
      jsonb_build_array('failed-cert'), jsonb_build_object('failed-assessment', 5));
    raise exception 'stale profile import unexpectedly permitted';
  exception when sqlstate 'PT412' then null;
  end;
  if exists (
    select 1 from public.migration_items
    where manifest_id = '30000000-0000-0000-0000-000000000004' and source_row_id = 'profile-failure'
  ) or exists (select 1 from public.earned_certifications where certification_id = 'failed-cert') then
    raise exception 'failed profile import did not roll back';
  end if;
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
exception when sqlstate 'PT412' then null;
end $$;
do $$
declare submission jsonb; first_submission timestamptz; retry_submission timestamptz;
begin
  select jsonb_build_array(jsonb_build_object(
    'event_id', '10000000-0000-0000-0000-000000000002', 'schema_version', 1,
    'certification_id', 'saa-c03', 'question_id', 'exam-1', 'question_revision', 1, 'source_version', 'question-2026-10',
    'category', 'security', 'mode', 'exam', 'exam_id', '20000000-0000-0000-0000-000000000002',
    'answered_at', response.selected_at, 'selected_at', response.selected_at, 'selected', response.selected, 'flagged', response.flagged, 'correct', jsonb_build_array('A'),
    'is_correct', true, 'duration_ms', response.duration_ms, 'attempt_number', 1, 'prior_incorrect_count', 0, 'reward', 1
  )) into submission from public.exam_responses response
    where response.exam_id = '20000000-0000-0000-0000-000000000002';
  begin
    perform public.finalize_exam_session('20000000-0000-0000-0000-000000000002', 0, null, submission);
    raise exception 'null expected finalization revision unexpectedly permitted';
  exception when sqlstate 'PT412' then null;
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

select public.start_exam_session('20000000-0000-0000-0000-000000000004', 'saa-c03', '2026-11',
  jsonb_build_array(
    jsonb_build_object('question_id', 'expired-finalize', 'question_revision', 1),
    jsonb_build_object('question_id', 'expired-flagged', 'question_revision', 1),
    jsonb_build_object('question_id', 'expired-unanswered', 'question_revision', 1)
  ), 60000, 0);
select public.save_exam_response('20000000-0000-0000-0000-000000000004', 0, 0, 0,
  jsonb_build_object('question_id', 'expired-finalize', 'question_revision', 1), jsonb_build_array('A'), true, 10, clock_timestamp());
select public.save_exam_response('20000000-0000-0000-0000-000000000004', 0, 1, 1,
  jsonb_build_object('question_id', 'expired-flagged', 'question_revision', 1), jsonb_build_array(), true, 0, null);
reset role;
update public.exam_sessions set started_at = clock_timestamp() - interval '2 seconds', deadline_at = clock_timestamp() - interval '1 second'
  where exam_id = '20000000-0000-0000-0000-000000000004';
update public.exam_responses response set selected_at = case when response.selected_at is null then null else session.deadline_at - interval '1 second' end,
  updated_at = session.deadline_at - interval '1 second'
  from public.exam_sessions session
  where response.exam_id = session.exam_id and session.exam_id = '20000000-0000-0000-0000-000000000004';
set local role authenticated;
do $$
declare submission jsonb; effective_submission timestamptz;
begin
  select jsonb_build_array(
    jsonb_build_object(
      'event_id', '10000000-0000-0000-0000-000000000004', 'schema_version', 1,
      'certification_id', 'saa-c03', 'question_id', 'expired-finalize', 'question_revision', 1, 'source_version', 'question-2026-10',
      'category', 'security', 'mode', 'exam', 'exam_id', '20000000-0000-0000-0000-000000000004',
      'answered_at', response.selected_at, 'selected_at', response.selected_at, 'selected', response.selected, 'flagged', response.flagged,
      'correct', jsonb_build_array('A'), 'is_correct', true, 'duration_ms', response.duration_ms,
      'attempt_number', 1, 'prior_incorrect_count', 0, 'reward', 1
    ), jsonb_build_object(
      'event_id', '10000000-0000-0000-0000-000000000005', 'schema_version', 1,
      'certification_id', 'saa-c03', 'question_id', 'expired-flagged', 'question_revision', 1, 'source_version', 'question-2026-10',
      'category', 'security', 'mode', 'exam', 'exam_id', '20000000-0000-0000-0000-000000000004',
      'answered_at', clock_timestamp(), 'selected_at', null, 'selected', jsonb_build_array(), 'flagged', true,
      'correct', jsonb_build_array('A'), 'is_correct', false, 'duration_ms', 0,
      'attempt_number', 1, 'prior_incorrect_count', 0, 'reward', 0
    ), jsonb_build_object(
      'event_id', '10000000-0000-0000-0000-000000000006', 'schema_version', 1,
      'certification_id', 'saa-c03', 'question_id', 'expired-unanswered', 'question_revision', 1, 'source_version', 'question-2026-10',
      'category', 'security', 'mode', 'exam', 'exam_id', '20000000-0000-0000-0000-000000000004',
      'answered_at', clock_timestamp(), 'selected_at', null, 'selected', jsonb_build_array(), 'flagged', false,
      'correct', jsonb_build_array('A'), 'is_correct', false, 'duration_ms', 0,
      'attempt_number', 1, 'prior_incorrect_count', 0, 'reward', 0
    )
  ) into submission from public.exam_responses response join public.exam_sessions session using (exam_id)
    where response.exam_id = '20000000-0000-0000-0000-000000000004';
  begin
    perform public.finalize_exam_session('20000000-0000-0000-0000-000000000004', 0, 2,
      jsonb_set(submission, '{0,selected}', jsonb_build_array('B')));
    raise exception 'expired exam accepted an unstored selection';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.finalize_exam_session('20000000-0000-0000-0000-000000000004', 0, 2,
      jsonb_set(submission, '{0,flagged}', 'false'));
    raise exception 'expired exam accepted an unstored flag';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.finalize_exam_session('20000000-0000-0000-0000-000000000004', 0, 2,
      jsonb_set(submission, '{0,selected_at}', to_jsonb(clock_timestamp()::text)));
    raise exception 'expired exam accepted an unstored selection time';
  exception when invalid_parameter_value then null;
  end;
  select public.finalize_exam_session('20000000-0000-0000-0000-000000000004', 0, 2, submission) into effective_submission;
  if not exists (
    select 1 from public.exam_sessions
    where exam_id = '20000000-0000-0000-0000-000000000004' and submitted_at = deadline_at
      and submitted_at = effective_submission and submitted_received_at > deadline_at
      and 2 = (select count(*) from public.learning_events event
        where event.event_id in ('10000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000006')
          and event.answered_at = deadline_at)
  ) then raise exception 'expired exam did not preserve its effective deadline and received time'; end if;
end $$;

select public.begin_migration(0, '30000000-0000-0000-0000-000000000001', 'profile-local-storage', 1, repeat('a', 64), 2);
select public.accept_migration_row(0, '30000000-0000-0000-0000-000000000001', 'profile');
select public.reject_migration_row(0, '30000000-0000-0000-0000-000000000001', 'corrupt', 'invalid-json');
do $$
begin
  begin
    perform public.append_learning_event(jsonb_build_object(
      'event_id', '10000000-0000-0000-0000-000000000030', 'schema_version', 1,
      'certification_id', 'saa-c03', 'question_id', 'profile-row-bypass', 'question_revision', 1,
      'source_version', '2026-11', 'category', 'security', 'mode', 'study',
      'answered_at', '2026-01-01T15:00:00Z', 'selected', jsonb_build_array(), 'correct', jsonb_build_array(),
      'is_correct', false, 'duration_ms', 0, 'attempt_number', 1, 'prior_incorrect_count', 0, 'reward', 0
    ), 0, '30000000-0000-0000-0000-000000000001', 'profile');
    raise exception 'profile migration row accepted an event';
  exception when unique_violation then null;
  end;
  if exists (select 1 from public.learning_events where event_id = '10000000-0000-0000-0000-000000000030') then
    raise exception 'profile migration row did not roll back the event';
  end if;
end $$;
select public.complete_migration(0, '30000000-0000-0000-0000-000000000001');
select public.complete_migration(0, '30000000-0000-0000-0000-000000000001');

select public.begin_migration(0, '30000000-0000-0000-0000-000000000002', 'exam-draft-local-storage', 1, repeat('b', 64), 1);
do $$
declare original_deadline timestamptz := clock_timestamp() + interval '10 minutes'; imported_exam jsonb;
  original_selection timestamptz := clock_timestamp() - interval '1 minute'; v_ref jsonb; v_bad_exam text;
  v_submission jsonb; v_finalized timestamptz;
begin
  imported_exam := jsonb_build_object(
    'exam_id', '20000000-0000-0000-0000-000000000003', 'certification_id', 'saa-c03', 'source_version', '2026-11',
    'question_order', jsonb_build_array(jsonb_build_object('question_id', 'draft-1', 'question_revision', 1)),
    'started_at', clock_timestamp() - interval '10 minutes', 'deadline_at', original_deadline,
    'position', 0, 'state', 'draft'
  );
  for v_ref, v_bad_exam in
    select value, case ordinal
      when 1 then '20000000-0000-0000-0000-000000000007'
      when 2 then '20000000-0000-0000-0000-000000000008'
      else '20000000-0000-0000-0000-000000000009'
    end
    from jsonb_array_elements(jsonb_build_array(
      jsonb_build_object('question_id', 'draft-1'),
      jsonb_build_object('question_id', 'draft-1', 'question_revision', 2),
      jsonb_build_object('question_id', 'draft-1', 'question_revision', 1, 'extra', true)
    )) with ordinality as invalid_ref(value, ordinal)
  loop
    begin
      perform public.import_exam_session(0, '30000000-0000-0000-0000-000000000002', 'invalid-ref-' || v_bad_exam,
        jsonb_set(imported_exam, '{exam_id}', to_jsonb(v_bad_exam)), jsonb_build_array(jsonb_build_object(
          'question_ref', v_ref, 'selected', jsonb_build_array(), 'flagged', false, 'duration_ms', 0
        )), '[]');
      raise exception 'partial imported question ref unexpectedly permitted';
    exception when invalid_parameter_value then null;
    end;
  end loop;
  if exists (select 1 from public.exam_sessions where exam_id in (
    '20000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000009'
  )) or exists (select 1 from public.exam_responses where exam_id in (
    '20000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000009'
  )) or exists (select 1 from public.migration_items where source_row_id like 'invalid-ref-%') then
    raise exception 'invalid imported question ref did not roll back';
  end if;
  begin
    perform public.import_exam_session(0, '30000000-0000-0000-0000-000000000002', 'bad-draft',
      jsonb_set(imported_exam, '{exam_id}', '"20000000-0000-0000-0000-000000000006"'), jsonb_build_array(jsonb_build_object(
        'question_ref', jsonb_build_object('question_id', 'draft-1', 'question_revision', 1),
        'selected', jsonb_build_array('A'), 'flagged', false, 'duration_ms', 10
      )), '[]');
    raise exception 'untimed legacy answer accepted';
  exception when invalid_parameter_value then null;
  end;
  if exists (select 1 from public.exam_sessions where exam_id = '20000000-0000-0000-0000-000000000006')
    or exists (select 1 from public.migration_items where source_row_id = 'bad-draft') then
    raise exception 'invalid draft import did not roll back';
  end if;
  for v_ref in select jsonb_build_object(
    'question_ref', jsonb_build_object('question_id', 'draft-1', 'question_revision', 1),
    'selected', selection.value, 'flagged', false, 'duration_ms', 10, 'selected_at', original_selection
  ) from jsonb_array_elements('[["A"],["B"]]'::jsonb) as selection(value) loop
    begin
      perform public.import_exam_session(0, '30000000-0000-0000-0000-000000000002', 'duplicate-response',
        jsonb_set(imported_exam, '{exam_id}', '"20000000-0000-0000-0000-000000000010"'),
        jsonb_build_array(jsonb_set(v_ref, '{selected}', '["A"]'::jsonb), v_ref), '[]');
      raise exception 'duplicate imported response accepted';
    exception when invalid_parameter_value then null;
    end;
  end loop;
  begin
    perform public.import_exam_session(0, '30000000-0000-0000-0000-000000000002', 'null-responses',
      jsonb_set(imported_exam, '{exam_id}', '"20000000-0000-0000-0000-000000000010"'), null, '[]');
    raise exception 'SQL NULL imported responses accepted';
  exception when invalid_parameter_value then null;
  end;
  if exists (select 1 from public.exam_sessions where exam_id = '20000000-0000-0000-0000-000000000010')
    or exists (select 1 from public.exam_responses where exam_id = '20000000-0000-0000-0000-000000000010')
    or exists (select 1 from public.migration_items where source_row_id in ('duplicate-response', 'null-responses')) then
    raise exception 'duplicate or NULL response import did not roll back';
  end if;
  perform public.import_exam_session(0, '30000000-0000-0000-0000-000000000002', 'draft-1', imported_exam, jsonb_build_array(jsonb_build_object(
    'question_ref', jsonb_build_object('question_id', 'draft-1', 'question_revision', 1),
    'selected', jsonb_build_array('A'), 'flagged', false, 'duration_ms', 10, 'selected_at', original_selection
  )), '[]');
  perform public.import_exam_session(0, '30000000-0000-0000-0000-000000000002', 'draft-1', imported_exam, jsonb_build_array(jsonb_build_object(
    'question_ref', jsonb_build_object('question_id', 'draft-1', 'question_revision', 1),
    'selected', jsonb_build_array('A'), 'flagged', false, 'duration_ms', 10, 'selected_at', original_selection
  )), '[]');
  begin
    perform public.import_exam_session(0, '30000000-0000-0000-0000-000000000002', 'draft-1',
      jsonb_set(imported_exam, '{exam_id}', '"20000000-0000-0000-0000-000000000005"'), jsonb_build_array(jsonb_build_object(
        'question_ref', jsonb_build_object('question_id', 'draft-1', 'question_revision', 1),
        'selected', jsonb_build_array('A'), 'flagged', false, 'duration_ms', 10, 'selected_at', original_selection
      )), '[]');
    raise exception 'migration row accepted a different exam';
  exception when unique_violation then null;
  end;
  if (select deadline_at from public.exam_sessions where exam_id = '20000000-0000-0000-0000-000000000003')
      is distinct from original_deadline then raise exception 'imported draft deadline was changed'; end if;
  if exists (select 1 from public.exam_sessions where exam_id = '20000000-0000-0000-0000-000000000005') then
    raise exception 'migration row created a second exam';
  end if;
  begin
    perform public.append_learning_event(jsonb_build_object(
      'event_id', '10000000-0000-0000-0000-000000000031', 'schema_version', 1,
      'certification_id', 'saa-c03', 'question_id', 'exam-row-bypass', 'question_revision', 1,
      'source_version', '2026-11', 'category', 'security', 'mode', 'study',
      'answered_at', '2026-01-01T15:00:00Z', 'selected', jsonb_build_array(), 'correct', jsonb_build_array(),
      'is_correct', false, 'duration_ms', 0, 'attempt_number', 1, 'prior_incorrect_count', 0, 'reward', 0
    ), 0, '30000000-0000-0000-0000-000000000002', 'draft-1');
    raise exception 'exam migration row accepted an event';
  exception when unique_violation then null;
  end;
  if exists (select 1 from public.learning_events where event_id = '10000000-0000-0000-0000-000000000031') then
    raise exception 'exam migration row did not roll back the event';
  end if;
  select jsonb_build_array(jsonb_build_object(
    'event_id', '10000000-0000-0000-0000-000000000032', 'schema_version', 1,
    'certification_id', 'saa-c03', 'question_id', 'draft-1', 'question_revision', 1, 'source_version', '2026-11',
    'category', 'security', 'mode', 'exam', 'exam_id', response.exam_id,
    'answered_at', response.selected_at, 'selected_at', response.selected_at,
    'selected', response.selected, 'flagged', response.flagged, 'duration_ms', response.duration_ms,
    'correct', jsonb_build_array('A'), 'is_correct', true, 'attempt_number', 1,
    'prior_incorrect_count', 0, 'reward', 1
  )) into v_submission from public.exam_responses response where exam_id = '20000000-0000-0000-0000-000000000003';
  select public.finalize_exam_session('20000000-0000-0000-0000-000000000003', 0, 0, v_submission) into v_finalized;
  if v_finalized is null or not exists (
    select 1 from public.exam_sessions
    where exam_id = '20000000-0000-0000-0000-000000000003' and state = 'submitted' and deadline_at = original_deadline
  ) or not exists (
    select 1 from public.learning_events
    where event_id = '10000000-0000-0000-0000-000000000032' and answered_at = original_selection
  ) then raise exception 'imported complete draft did not finalize with its original timing'; end if;
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
  begin
    perform public.load_roadmap_profile_snapshot();
    raise exception 'anon profile snapshot unexpectedly permitted';
  exception when insufficient_privilege then null;
  end;
  perform public.append_learning_event('{}', 0);
  raise exception 'anon RPC unexpectedly permitted';
exception when insufficient_privilege then null;
end $$;
rollback;
