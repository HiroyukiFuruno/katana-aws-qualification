begin;

insert into auth.users (id, email) values
  ('88888888-8888-4888-8888-888888888888', 'fundamentals-import@example.test');

insert into public.published_fundamentals_catalogs (
  unit_id, content_version, content_hash, plan, final_questions
)
select
  'import-unit',
  'v1',
  extensions.digest('fundamentals-import-v1', 'sha256'),
  jsonb_build_array(
    jsonb_build_object('position', 1, 'kind', 'slide', 'id', 'slide-1', 'required', true),
    jsonb_build_object(
      'position', 2, 'kind', 'checkpoint', 'id', 'check-1', 'required', true,
      'question', jsonb_build_object(
        'questionId', 'check-1', 'revision', 1, 'sourceVersion', 'v1', 'category', 'import',
        'selectionPolarity', 'correct', 'requiredChoices', 1,
        'choiceIds', jsonb_build_array('a', 'b'), 'correctChoiceIds', jsonb_build_array('a'),
        'explanationRef', 'check-1-explanation'
      )
    )
  ),
  jsonb_agg(
    jsonb_build_object(
      'position', item - 1,
      'questionId', 'final-' || item,
      'revision', 1,
      'sourceVersion', 'v1',
      'category', 'import',
      'selectionPolarity', case when item % 4 in (1, 3) then 'correct' else 'incorrect' end,
      'requiredChoices', case when item % 4 in (1, 2) then 1 else 2 end,
      'choiceIds', jsonb_build_array('a', 'b', 'c'),
      'correctChoiceIds', case when item % 4 in (1, 2) then jsonb_build_array('a') else jsonb_build_array('a', 'b') end
    ) order by item
  )
from generate_series(1, 12) questions(item);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', '88888888-8888-4888-8888-888888888888', 'role', 'authenticated')::text,
  true
);

do $test$
declare
  v_manifest uuid := '81111111-1111-4111-8111-111111111111';
  v_session uuid := '82222222-2222-4222-8222-222222222222';
  v_payload jsonb;
  v_order jsonb;
  v_responses jsonb := '{}'::jsonb;
  v_event_ids jsonb := '[]'::jsonb;
  v_position integer;
  v_question jsonb;
  v_selected jsonb;
  v_second_manifest uuid := '83333333-3333-4333-8333-333333333333';
  v_invalid_manifest uuid := '83444444-4444-4444-8444-444444444444';
  v_infinite_manifest uuid := '83555555-5555-4555-8555-555555555555';
  v_conflict jsonb;
begin
  perform public.initialize_learning_state();
  select jsonb_agg(
    jsonb_build_object(
      'position', item - 1,
      'questionId', 'final-' || item,
      'revision', 1,
      'sourceVersion', 'v1'
    ) order by item
  ) into v_order from generate_series(1, 12) questions(item);

  for v_position in 0..11 loop
    v_question := jsonb_build_object(
      'requiredChoices', case when (v_position + 1) % 4 in (1, 2) then 1 else 2 end,
      'correctChoiceIds', case when (v_position + 1) % 4 in (1, 2) then jsonb_build_array('a') else jsonb_build_array('a', 'b') end
    );
    v_selected := case
      when v_position = 10 then '[]'::jsonb
      when v_position = 11 then jsonb_build_array('a')
      else v_question->'correctChoiceIds'
    end;
    v_responses := jsonb_set(v_responses, array[v_position::text], jsonb_build_object(
      'questionRef', (v_order->v_position) - 'position',
      'selected', v_selected,
      'selectedAt', '2026-11-20T00:00:0' || (v_position % 10)::text || 'Z',
      'durationMs', 100 + v_position
    ));
    v_event_ids := v_event_ids || jsonb_build_array(
      ('84444444-4444-4444-8444-' || lpad((v_position + 1)::text, 12, '0'))::uuid
    );
  end loop;

  v_payload := jsonb_build_object(
    'unitId', 'import-unit',
    'contentVersion', 'v1',
    'completedSlideIds', jsonb_build_array('slide-1'),
    'completedCheckpointIds', jsonb_build_array('check-1'),
    'furthestPlanPosition', 2,
    'resumeStage', 'result',
    'resumeStepId', null,
    'checkpointReceipts', jsonb_build_array(jsonb_build_object(
      'stepId', 'check-1',
      'receiptId', '85555555-5555-4555-8555-555555555555',
      'questionRef', jsonb_build_object('questionId', 'check-1', 'revision', 1, 'sourceVersion', 'v1'),
      'selected', jsonb_build_array('a'),
      'answeredAt', '2026-11-20T00:00:00Z',
      'durationMs', 1200
    )),
    'activeFinal', null,
    'submittedFinals', jsonb_build_array(jsonb_build_object(
      'sessionId', v_session,
      'startedAt', '2026-11-20T00:00:00Z',
      'questionOrder', v_order,
      'responses', v_responses,
      'submittedAt', '2026-11-20T00:05:00Z',
      'eventIds', v_event_ids
    ))
  );
  perform public.begin_migration(
    0, v_manifest, 'fundamentals-progress-local-storage', 1,
    repeat('a', 64), 1
  );
  perform public.import_fundamentals_unit(0, v_manifest, 'import-unit:v1', v_payload);
  perform public.import_fundamentals_unit(0, v_manifest, 'import-unit:v1', v_payload);
  perform public.complete_migration(0, v_manifest);
  if public.load_fundamentals_snapshot('import-unit', 'v1', 0)->'progress'->>'resumeStage' is distinct from 'result'
    or public.load_fundamentals_snapshot('import-unit', 'v1', 0)->'progress'->'resumeStepId' is distinct from 'null'::jsonb then
    raise exception 'submitted guest import did not resume at the result without a lesson step id';
  end if;
  if public.load_fundamentals_progress_summaries(
    jsonb_build_array(jsonb_build_object('unitId', 'import-unit', 'contentVersion', 'v1')), 0
  )->0->>'latestScore' is distinct from '10' then
    raise exception 'progress summary did not read the owner submitted result';
  end if;

  perform public.start_fundamentals_final(
    '86666666-6666-4666-8666-666666666666', 'import-unit', 'v1', 1, 0
  );
  perform public.begin_migration(
    0, v_second_manifest, 'fundamentals-progress-local-storage', 1,
    repeat('b', 64), 1
  );
  v_conflict := jsonb_set(v_payload, '{activeFinal}', jsonb_build_object(
    'sessionId', '87777777-7777-4777-8777-777777777777',
    'startedAt', '2026-11-20T01:00:00Z',
    'position', 0,
    'questionOrder', v_order,
    'responses', '{}'::jsonb
  ));
  v_conflict := jsonb_set(v_conflict, '{submittedFinals}', '[]'::jsonb);
  begin
    perform public.import_fundamentals_unit(0, v_second_manifest, 'import-unit:v1', v_conflict);
    raise exception 'conflicting active final was accepted';
  exception when sqlstate 'PT412' then null;
  end;
  perform public.begin_migration(
    0, v_invalid_manifest, 'profile-local-storage', 1, repeat('c', 64), 1
  );
  begin
    perform public.import_fundamentals_unit(0, v_invalid_manifest, 'import-unit:v1', v_payload);
    raise exception 'wrong manifest source was accepted';
  exception when sqlstate '22023' then null;
  end;
  perform public.begin_migration(
    0, v_infinite_manifest, 'fundamentals-progress-local-storage', 1, repeat('d', 64), 1
  );
  begin
    perform public.import_fundamentals_unit(
      0, v_infinite_manifest, 'import-unit:v1',
      jsonb_set(v_payload, '{checkpointReceipts,0,answeredAt}', '"infinity"'::jsonb)
    );
    raise exception 'infinite checkpoint timestamp was accepted';
  exception when sqlstate '22023' then null;
  end;
end $test$;

reset role;
do $test$
begin
  if not exists (
    select 1 from public.fundamentals_final_sessions
    where user_id = '88888888-8888-4888-8888-888888888888'
      and session_id = '82222222-2222-4222-8222-222222222222'
      and state = 'submitted' and score = 10 and required_score = 10 and passed
  ) then
    raise exception 'submitted guest final was not server-rescored';
  end if;
  if (select count(*) from public.learning_events where user_id = '88888888-8888-4888-8888-888888888888') <> 13 then
    raise exception 'checkpoint and submitted final history was not recorded exactly once';
  end if;
  if not exists (
    select 1 from public.learning_events
    where user_id = '88888888-8888-4888-8888-888888888888'
      and event_id = '85555555-5555-4555-8555-555555555555'
      and answered_at = '2026-11-20T00:00:00Z'::timestamptz and duration_ms = 1200
  ) then
    raise exception 'checkpoint source timestamp or duration was not retained';
  end if;
  if (select count(distinct selection_polarity || ':' || required_choices::text)
    from public.learning_events
    where user_id = '88888888-8888-4888-8888-888888888888'
      and fundamentals_session_id = '82222222-2222-4222-8222-222222222222') <> 4 then
    raise exception 'all four answer forms were not retained';
  end if;
  if not exists (
    select 1 from public.learning_events
    where user_id = '88888888-8888-4888-8888-888888888888'
      and fundamentals_session_id = '82222222-2222-4222-8222-222222222222'
      and question_id = 'final-1' and answered_at = '2026-11-20T00:00:00Z'::timestamptz
  ) then
    raise exception 'submitted final did not retain selectedAt for history';
  end if;
  if not exists (
    select 1 from public.learning_events
    where user_id = '88888888-8888-4888-8888-888888888888'
      and fundamentals_session_id = '82222222-2222-4222-8222-222222222222'
      and question_id = 'final-11' and selected = '[]'::jsonb and not is_correct
  ) or not exists (
    select 1 from public.learning_events
    where user_id = '88888888-8888-4888-8888-888888888888'
      and fundamentals_session_id = '82222222-2222-4222-8222-222222222222'
      and question_id = 'final-12' and selected = '["a"]'::jsonb and not is_correct
  ) then
    raise exception 'unanswered or partial final selections were not imported as incorrect history';
  end if;
  if (select responses->'10'->'selected' from public.fundamentals_final_sessions
    where user_id = '88888888-8888-4888-8888-888888888888'
      and session_id = '82222222-2222-4222-8222-222222222222') is distinct from '[]'::jsonb
    or (select responses->'11'->'selected' from public.fundamentals_final_sessions
      where user_id = '88888888-8888-4888-8888-888888888888'
        and session_id = '82222222-2222-4222-8222-222222222222') is distinct from '["a"]'::jsonb then
    raise exception 'submitted final snapshot did not retain unanswered or partial selections';
  end if;
  if exists (
    select 1 from public.migration_items
    where user_id = '88888888-8888-4888-8888-888888888888'
      and manifest_id = '83333333-3333-4333-8333-333333333333'
  ) then
    raise exception 'active conflict partially imported the source row';
  end if;
end $test$;
rollback;
