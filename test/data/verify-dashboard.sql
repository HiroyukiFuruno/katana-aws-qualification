begin;

do $test$
begin
  if has_function_privilege('anon', 'public.dashboard_summary(jsonb,bigint)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.dashboard_summary(jsonb,bigint)', 'EXECUTE')
    or has_function_privilege('anon', 'public.save_dashboard_settings(jsonb,bigint,bigint)', 'EXECUTE') then
    raise exception 'dashboard RPC permissions are incorrect';
  end if;
end $test$;

insert into auth.users (id, email) values
  ('a1111111-1111-4111-8111-111111111111', 'dashboard-a@example.test'),
  ('b1111111-1111-4111-8111-111111111111', 'dashboard-b@example.test');
insert into public.learning_state(user_id, generation) values
  ('a1111111-1111-4111-8111-111111111111', 0),
  ('b1111111-1111-4111-8111-111111111111', 0);
insert into public.published_fundamentals_catalogs(unit_id, content_version, content_hash, plan, final_questions) values (
  'dashboard-unit', 'v1', extensions.digest('dashboard-unit-v1', 'sha256'),
  jsonb_build_array(
    jsonb_build_object('position', 1, 'kind', 'slide', 'id', 'slide-1', 'required', true),
    jsonb_build_object('position', 2, 'kind', 'checkpoint', 'id', 'check-1', 'required', true,
      'question', jsonb_build_object('questionId', 'checkpoint-1', 'revision', 1, 'sourceVersion', 'lesson-v1', 'category', 'security', 'format', 'ordering', 'requiredChoices', 3, 'choiceIds', jsonb_build_array('a','b','c'), 'correctChoiceIds', jsonb_build_array('a','b','c'), 'selectionPolarity', 'correct', 'explanationRef', 'check-1'))
  ),
  (select jsonb_agg(jsonb_build_object(
    'position', position, 'questionId', 'lesson-final-' || (position + 1), 'revision', 1, 'sourceVersion', 'lesson-v1',
    'category', case when position = 0 then 'security' else 'storage' end,
    'requiredChoices', case when position = 0 then 2 else 1 end,
    'choiceIds', jsonb_build_array('a','b'), 'correctChoiceIds', case when position = 0 then jsonb_build_array('a','b') else jsonb_build_array('a') end,
    'selectionPolarity', case when position = 0 then 'incorrect' else 'correct' end
  ) || case when position = 0 then jsonb_build_object('format','matching') else '{}'::jsonb end order by position) from generate_series(0,11) position)
);
insert into public.fundamentals_final_sessions (
  user_id, session_id, unit_id, content_version, catalog_hash, start_hash, question_order, responses, position,
  state, score, required_score, passed, started_at, submitted_at, submitted_received_at, submission_hash
) values (
  'a1111111-1111-4111-8111-111111111111', 'a2222222-2222-4222-8222-222222222222', 'dashboard-unit', 'v1',
  extensions.digest('dashboard-unit-v1', 'sha256'), extensions.digest('dashboard-start', 'sha256'),
  (select final_questions from public.published_fundamentals_catalogs where unit_id = 'dashboard-unit' and content_version = 'v1'),
  '{}'::jsonb, 11, 'submitted', 10, 10, true, '2026-03-08T07:10:00Z', '2026-03-08T07:20:00Z', '2026-03-08T07:20:00Z', extensions.digest('dashboard-submit', 'sha256')
);
insert into public.exam_sessions (
  user_id, exam_id, start_hash, certification_id, source_version, question_order, legacy_import, state, submission_hash
) values (
  'a1111111-1111-4111-8111-111111111111', 'a3333333-3333-4333-8333-333333333333', extensions.digest('dashboard-exam', 'sha256'),
  'saa-c03', 'mock-v1', jsonb_build_array(jsonb_build_object('question_id', 'exam-1', 'question_revision', 1)), true, 'submitted', extensions.digest('dashboard-exam-submit', 'sha256')
);

insert into public.learning_events (
  user_id, event_id, payload_hash, schema_version, certification_id, question_id, question_revision, source_version,
  category, mode, exam_id, answered_at, selected, correct, answer_format, is_correct, duration_ms, attempt_number,
  prior_incorrect_count, review_correct, reward, fundamentals_session_id, learning_context, selection_polarity, required_choices
) values
  ('a1111111-1111-4111-8111-111111111111', 'a4000000-0000-4000-8000-000000000000', extensions.digest('a0','sha256'), 1, 'saa-c03', 'practice-order', 1, '2026-01', 'security', 'review', null, '2026-03-08T07:00:00Z', '["a","b","c"]', '["a","b","c"]', 'ordering', true, 500, 1, 0, true, 1, null, null, 'correct', 3),
  ('a1111111-1111-4111-8111-111111111111', 'a4000000-0000-4000-8000-000000000001', extensions.digest('a1','sha256'), 1, 'saa-c03', 'practice-single', 1, '2026-01', 'security', 'study', null, '2026-03-08T06:59:00Z', '["a"]', '["a"]', null, true, 1000, 1, 0, null, 1, null, null, null, 1),
  ('a1111111-1111-4111-8111-111111111111', 'a4000000-0000-4000-8000-000000000002', extensions.digest('a2','sha256'), 1, 'saa-c03', 'practice-order', 1, '2026-01', 'security', 'review', null, '2026-03-08T07:00:00Z', '["b","a","c"]', '["a","b","c"]', 'ordering', false, 7000, 1, 1, false, 0, null, null, 'correct', 3),
  ('a1111111-1111-4111-8111-111111111111', 'a4000000-0000-4000-8000-000000000003', extensions.digest('a3','sha256'), 1, 'saa-c03', 'practice-match', 2, '2026-02', 'storage', 'study', null, '2026-03-09T08:00:00Z', '["b","a"]', '["a","b"]', 'matching', true, 31000, 1, 0, null, 1, null, null, 'incorrect', 2),
  ('a1111111-1111-4111-8111-111111111111', 'a4000000-0000-4000-8000-000000000004', extensions.digest('a4','sha256'), 1, 'fundamentals', 'checkpoint-1', 1, 'lesson-v1', 'security', 'study', null, '2026-03-08T07:05:00Z', '["c","b","a"]', '["a","b","c"]', null, false, 15000, 1, 1, null, 0, null, jsonb_build_object('kind','lesson-checkpoint','unitId','dashboard-unit','contentVersion','v1','stepId','check-1'), 'correct', 3),
  ('a1111111-1111-4111-8111-111111111111', 'a4000000-0000-4000-8000-000000000005', extensions.digest('a5','sha256'), 1, 'fundamentals', 'lesson-final-1', 1, 'lesson-v1', 'security', 'study', null, '2026-03-08T07:20:00Z', '["a","b"]', '["a","b"]', null, true, 60000, 1, 0, null, 1, 'a2222222-2222-4222-8222-222222222222', jsonb_build_object('kind','lesson-final','unitId','dashboard-unit','contentVersion','v1','sessionId','a2222222-2222-4222-8222-222222222222','position',0), 'incorrect', 2),
  ('a1111111-1111-4111-8111-111111111111', 'a4000000-0000-4000-8000-000000000006', extensions.digest('a6','sha256'), 1, 'fundamentals', 'lesson-final-2', 1, 'lesson-v1', 'storage', 'study', null, '2026-03-08T07:20:00Z', '["b"]', '["a"]', null, false, 120000, 1, 1, null, 0, 'a2222222-2222-4222-8222-222222222222', jsonb_build_object('kind','lesson-final','unitId','dashboard-unit','contentVersion','v1','sessionId','a2222222-2222-4222-8222-222222222222','position',1), 'correct', 1),
  ('a1111111-1111-4111-8111-111111111111', 'a4000000-0000-4000-8000-000000000007', extensions.digest('a7','sha256'), 1, 'saa-c03', 'exam-1', 1, 'mock-v1', 'security', 'exam', 'a3333333-3333-4333-8333-333333333333', '2026-03-08T07:30:00Z', '["b"]', '["a"]', null, false, 300000, 1, 1, null, 0, null, null, null, 1),
  ('b1111111-1111-4111-8111-111111111111', 'b4000000-0000-4000-8000-000000000001', extensions.digest('b1','sha256'), 1, 'clf-c02', 'other-owner', 1, '2026-01', 'cloud', 'study', null, '2026-03-08T08:00:00Z', '["a"]', '["a"]', null, true, 10, 1, 0, null, 1, null, null, null, 1);

insert into public.learning_events (
  user_id, event_id, payload_hash, schema_version, certification_id, question_id, question_revision, source_version,
  category, mode, answered_at, selected, correct, is_correct, duration_ms, attempt_number, prior_incorrect_count,
  review_correct, reward, fundamentals_session_id, learning_context, selection_polarity, required_choices
)
select
  'a1111111-1111-4111-8111-111111111111',
  ('a5000000-0000-4000-8000-' || lpad((position + 1)::text, 12, '0'))::uuid,
  extensions.digest('dashboard-final-' || position, 'sha256'), 1, 'fundamentals', 'lesson-final-' || (position + 1), 1,
  'lesson-v1', 'storage', 'study', '2026-03-08T07:20:00Z',
  case when position = 11 then '["b"]'::jsonb else '["a"]'::jsonb end, '["a"]'::jsonb,
  position <> 11, (position + 1) * 1000, 1, case when position = 11 then 1 else 0 end, null,
  case when position = 11 then 0 else 1 end, 'a2222222-2222-4222-8222-222222222222',
  jsonb_build_object('kind','lesson-final','unitId','dashboard-unit','contentVersion','v1','sessionId','a2222222-2222-4222-8222-222222222222','position',position),
  'correct', 1
from generate_series(2,11) position;

set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub','a1111111-1111-4111-8111-111111111111','role','authenticated')::text, true);

do $test$
declare
  v_query jsonb := jsonb_build_object(
    'range', jsonb_build_object('from', null, 'to', '2026-03-10T00:00:00Z', 'timezone', 'America/Los_Angeles'),
    'certificationIds', null, 'categories', null, 'modes', null, 'contexts', null, 'formats', null,
    'polarities', null, 'revisions', null, 'unitIds', null
  );
  v_summary jsonb;
  v_settings jsonb := jsonb_build_object(
    'schemaVersion', 1,
    'filters', jsonb_build_object('period','30d','timezone','UTC','certificationIds',null,'categories',null,'modes',null,'contexts',null,'formats',null,'polarities',null,'revisions',null,'unitIds',null),
    'widgets', jsonb_build_array(jsonb_build_object('id','trend-1','kind','trend','visible',true,'width','wide','chart','line','metric','answered','dimension','default','overrides',jsonb_build_object()))
  );
begin
  v_summary := public.dashboard_summary(v_query, 0);
  if v_summary->'total'->>'answered' <> '18' or v_summary->'total'->>'correct' <> '13'
    or v_summary->'duration'->>'count' <> '18'
    or v_summary::text like '%"selected"%' then
    raise exception 'dashboard returned wrong totals or raw answers';
  end if;
  if not exists (select 1 from jsonb_array_elements(v_summary->'groups'->'formats') item where item->>'key' = 'ordering')
    or not exists (select 1 from jsonb_array_elements(v_summary->'groups'->'formats') item where item->>'key' = 'matching')
    or not exists (select 1 from jsonb_array_elements(v_summary->'groups'->'contexts') item where item->>'key' = 'lesson-final') then
    raise exception 'dashboard did not derive format or context';
  end if;
  if not exists (select 1 from jsonb_array_elements(v_summary->'daily') item where item->>'date' = '2026-03-07' and item->>'answered' = '17') then
    raise exception 'IANA daily aggregation did not preserve the DST-side date boundary';
  end if;
  if v_summary->'exams'->0->'submittedAt' is distinct from 'null'::jsonb
    or v_summary->'exams'->0->>'lastAnsweredAt' <> '2026-03-08T07:30:00+00:00' then
    raise exception 'legacy submitted timestamp was invented or answer time lost';
  end if;
  if v_summary->'lessonFinals'->0->'stats'->>'answered' <> '12' or v_summary->'lessonFinals'->0->'allAnswers'->>'answered' <> '12'
    or v_summary->'lessonFinals'->0->'allAnswers'->>'correct' <> '10'
    or v_summary->'lessonFinals'->0->>'score' <> '10' or v_summary->'lessonFinals'->0->>'requiredScore' <> '10' then
    raise exception 'lesson final aggregate is wrong';
  end if;
  if v_summary->'duration'->'bins' <> jsonb_build_array(
    jsonb_build_object('lowerMs',0,'upperMs',1000,'count',1),
    jsonb_build_object('lowerMs',1000,'upperMs',5000,'count',3),
    jsonb_build_object('lowerMs',5000,'upperMs',10000,'count',6),
    jsonb_build_object('lowerMs',10000,'upperMs',30000,'count',4),
    jsonb_build_object('lowerMs',30000,'upperMs',60000,'count',1),
    jsonb_build_object('lowerMs',60000,'upperMs',120000,'count',1),
    jsonb_build_object('lowerMs',120000,'upperMs',300000,'count',1),
    jsonb_build_object('lowerMs',300000,'upperMs',null,'count',1)
  ) then
    raise exception 'dashboard duration bins do not match the public contract';
  end if;
  if not exists (
    select 1 from jsonb_array_elements(v_summary->'review') item
    where item->>'questionId' = 'practice-order' and item->>'answered' = '2' and item->>'incorrectCount' = '1'
  ) then
    raise exception 'review queue did not use event id as the same-time tie breaker';
  end if;
  if public.load_dashboard_settings(0) <> jsonb_build_object('revision',0,'settings',null) then raise exception 'initial dashboard settings are wrong'; end if;
  if public.save_dashboard_settings(v_settings,0,0)->>'revision' <> '1'
    or public.save_dashboard_settings(v_settings,0,0)->>'revision' <> '1' then raise exception 'settings retry was not idempotent'; end if;
  begin perform public.save_dashboard_settings(jsonb_set(v_settings,'{widgets,0,metric}','"durationMs"'),0,0); raise exception 'stale settings overwrite accepted'; exception when sqlstate 'PT412' then null; end;
  begin perform public.save_dashboard_settings(v_settings || jsonb_build_object('unknown',true),1,0); raise exception 'unknown settings field accepted'; exception when sqlstate '22023' then null; end;
  begin perform public.save_dashboard_settings(jsonb_set(v_settings,'{schemaVersion}','"1"'),1,0); raise exception 'string settings schema version accepted'; exception when sqlstate '22023' then null; end;
  begin perform public.save_dashboard_settings(jsonb_set(v_settings,'{widgets,0,chart}','"donut"'),1,0); raise exception 'incompatible widget chart accepted'; exception when sqlstate '22023' then null; end;
  begin perform public.save_dashboard_settings(jsonb_set(v_settings,'{widgets,0,chart}','"stacked"'),1,0); raise exception 'incompatible stacked widget metric accepted'; exception when sqlstate '22023' then null; end;
  begin perform public.save_dashboard_settings(null,1,0); raise exception 'SQL null dashboard settings accepted'; exception when sqlstate '22023' then null; end;
  begin perform public.dashboard_summary(v_query || jsonb_build_object('unknown',true),0); raise exception 'unknown query field accepted'; exception when sqlstate '22023' then null; end;
  begin perform public.dashboard_summary(v_query - 'formats',0); raise exception 'missing query field accepted'; exception when sqlstate '22023' then null; end;
  begin perform public.dashboard_summary(null,0); raise exception 'SQL null query accepted'; exception when sqlstate '22023' then null; end;
  begin perform public.dashboard_summary(jsonb_set(v_query,'{formats}','[]'::jsonb),0); raise exception 'empty query filter accepted'; exception when sqlstate '22023' then null; end;
  begin perform public.dashboard_summary(v_query,1); raise exception 'stale dashboard generation accepted'; exception when sqlstate 'PT409' then null; end;
  v_summary := public.dashboard_summary(jsonb_set(v_query,'{range,from}','"2026-03-08T07:00:00Z"'),0);
  if v_summary->'total'->>'answered' <> '17' then raise exception 'UTC half-open range did not exclude pre-boundary event'; end if;
  v_summary := public.dashboard_summary(jsonb_set(v_query,'{categories}',jsonb_build_array('security')),0);
  if v_summary->'lessonFinals'->0->'stats'->>'answered' <> '1' or v_summary->'lessonFinals'->0->'allAnswers'->>'answered' <> '12' then
    raise exception 'session scoped and full answer stats were mixed';
  end if;
  if public.dashboard_summary(jsonb_set(v_query,'{certificationIds}',jsonb_build_array('fundamentals')),0)->'total'->>'answered' <> '13' then
    raise exception 'certification filter did not scope fundamentals';
  end if;
  if public.dashboard_summary(jsonb_set(v_query,'{modes}',jsonb_build_array('review')),0)->'total'->>'answered' <> '2' then
    raise exception 'mode filter did not scope review';
  end if;
  if public.dashboard_summary(jsonb_set(v_query,'{contexts}',jsonb_build_array('lesson-checkpoint')),0)->'total'->>'answered' <> '1' then
    raise exception 'context filter did not scope checkpoint';
  end if;
  if public.dashboard_summary(jsonb_set(v_query,'{formats}',jsonb_build_array('matching')),0)->'total'->>'answered' <> '2' then
    raise exception 'format filter did not use catalog-derived matching values';
  end if;
  if public.dashboard_summary(jsonb_set(v_query,'{polarities}',jsonb_build_array('unspecified')),0)->'total'->>'answered' <> '2' then
    raise exception 'polarity filter did not retain unspecified values';
  end if;
  if public.dashboard_summary(jsonb_set(v_query,'{revisions}',jsonb_build_array(jsonb_build_object('sourceVersion','2026-02','questionRevision',2))),0)->'total'->>'answered' <> '1' then
    raise exception 'source revision pair filter did not scope answers';
  end if;
  v_summary := public.dashboard_summary(jsonb_set(v_query,'{certificationIds}',jsonb_build_array('none')),0);
  if v_summary->'total'->>'answered' <> '0' or v_summary->'total'->'accuracy' is distinct from 'null'::jsonb
    or v_summary->'duration'->'min' is distinct from 'null'::jsonb then
    raise exception 'empty dashboard result fabricated a measurement';
  end if;
  v_summary := public.dashboard_summary(jsonb_set(v_query,'{unitIds}',jsonb_build_array('dashboard-unit')),0);
  if v_summary->'total'->>'answered' <> '13' then raise exception 'unit filter did not scope lesson events'; end if;
end $test$;

reset role;
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub','b1111111-1111-4111-8111-111111111111','role','authenticated')::text, true);
do $test$
declare v_query jsonb := jsonb_build_object('range',jsonb_build_object('from',null,'to','2026-03-10T00:00:00Z','timezone','UTC'),'certificationIds',null,'categories',null,'modes',null,'contexts',null,'formats',null,'polarities',null,'revisions',null,'unitIds',null);
begin
  if public.dashboard_summary(v_query,0)->'total'->>'answered' <> '1' then raise exception 'dashboard owner isolation failed'; end if;
  if exists (select 1 from public.dashboard_settings where user_id = 'a1111111-1111-4111-8111-111111111111') then raise exception 'dashboard settings RLS failed'; end if;
end $test$;

reset role;
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub','a1111111-1111-4111-8111-111111111111','role','authenticated')::text, true);
select public.reset_my_learning_data(0);
do $test$
begin
  if public.load_dashboard_settings(1)->>'revision' <> '1' then raise exception 'learning reset removed dashboard settings'; end if;
end $test$;
reset role;
delete from auth.users where id = 'a1111111-1111-4111-8111-111111111111';
do $test$
begin
  if exists (select 1 from public.dashboard_settings where user_id = 'a1111111-1111-4111-8111-111111111111') then raise exception 'account deletion did not cascade dashboard settings'; end if;
end $test$;

rollback;
