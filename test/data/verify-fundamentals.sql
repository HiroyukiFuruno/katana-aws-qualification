begin;
do $test$
begin
  if has_function_privilege('anon','public.load_fundamentals_progress_summaries(jsonb,bigint)','EXECUTE')
    or not has_function_privilege('authenticated','public.load_fundamentals_progress_summaries(jsonb,bigint)','EXECUTE') then
    raise exception 'fundamentals summaries must only be executable by authenticated users';
  end if;
  if has_function_privilege('anon','public.load_fundamentals_history_summaries(jsonb,bigint)','EXECUTE')
    or not has_function_privilege('authenticated','public.load_fundamentals_history_summaries(jsonb,bigint)','EXECUTE') then
    raise exception 'fundamentals history summaries must only be executable by authenticated users';
  end if;
  if has_function_privilege('anon','public.load_fundamentals_checkpoint_selection(text,text,text,integer,text,bigint)','EXECUTE')
    or not has_function_privilege('authenticated','public.load_fundamentals_checkpoint_selection(text,text,text,integer,text,bigint)','EXECUTE') then
    raise exception 'historical checkpoint selections must only be executable by authenticated users';
  end if;
end $test$;
insert into auth.users (id,email) values
  ('55555555-5555-4555-8555-555555555555','fundamentals-a@example.test'),
  ('66666666-6666-4666-8666-666666666666','fundamentals-b@example.test'),
  ('77777777-7777-4777-8777-777777777777','fundamentals-delete@example.test');
insert into public.published_fundamentals_catalogs(unit_id,content_version,content_hash,plan,final_questions)
select 'draft-unit','v1',extensions.digest('fundamentals-catalog-v1','sha256'),
  jsonb_build_array(jsonb_build_object('position',1,'kind','slide','id','slide-1','required',true),jsonb_build_object('position',2,'kind','checkpoint','id','check-1','required',true,'question',jsonb_build_object('questionId','check-1','revision',1,'sourceVersion','v1','category','draft','selectionPolarity','correct','requiredChoices',1,'choiceIds',jsonb_build_array('a','b'),'correctChoiceIds',jsonb_build_array('a'),'explanationRef','check-1-explanation'))),
  jsonb_agg(jsonb_build_object('position',item-1,'questionId','final-'||item,'revision',1,'sourceVersion','v1','category','draft','selectionPolarity','correct','requiredChoices',1,'choiceIds',jsonb_build_array('a','b'),'correctChoiceIds',jsonb_build_array('a')) order by item)
from generate_series(1,12) questions(item);
do $test$
begin
  begin update public.published_fundamentals_catalogs set plan='[]' where unit_id='draft-unit'; raise exception 'catalog update accepted'; exception when sqlstate '55000' then null; end;
  begin delete from public.published_fundamentals_catalogs where unit_id='draft-unit'; raise exception 'catalog delete accepted'; exception when sqlstate '55000' then null; end;
  insert into public.published_fundamentals_catalogs values('draft-unit','v2',extensions.digest('fundamentals-catalog-v2','sha256'),'[]','[]',clock_timestamp());
end $test$;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub','55555555-5555-4555-8555-555555555555','role','authenticated')::text,true);
do $test$
declare position integer; session_one uuid:='11111111-1111-4111-8111-111111111111'; session_two uuid:='22222222-2222-4222-8222-222222222222'; session_three uuid:='33333333-3333-4333-8333-333333333333';
  v_history jsonb;
begin
  perform public.initialize_learning_state();
  perform public.record_fundamentals_step('draft-unit','v1','slide','slide-1',null,0,0,'44444444-4444-4444-8444-444444444444');
  perform public.record_fundamentals_step('draft-unit','v1','checkpoint','check-1','["a"]',1,0,'88888888-8888-4888-8888-888888888888',1200);
  if public.load_fundamentals_checkpoint_selection('draft-unit','v1','check-1',1,'v1',0) is distinct from '["a"]'::jsonb
    or public.load_fundamentals_checkpoint_selection('draft-unit','v2','check-1',1,'v1',0) is not null
    or public.load_fundamentals_checkpoint_selection('draft-unit','v1','check-1',2,'v1',0) is not null then
    raise exception 'checkpoint history did not preserve the exact answer identity';
  end if;
  begin perform public.record_fundamentals_step('draft-unit','v1','checkpoint','check-1','["b"]',1,0,'88888888-8888-4888-8888-888888888888',1200); raise exception 'receipt collision accepted'; exception when unique_violation then null; end;
  perform public.start_fundamentals_final(session_one,'draft-unit','v1',2,0);
  if public.load_fundamentals_snapshot('draft-unit','v1',0)->'progress'->'resumeStepId' is distinct from 'null'::jsonb then
    raise exception 'active final exposed a non-lesson resume step id';
  end if;
  perform public.save_fundamentals_final_response(session_one,0,0,'{"questionId":"final-1","revision":1,"sourceVersion":"v1"}','["a"]',0,'99999999-9999-4999-8999-999999999991',42,0);
  perform public.finalize_fundamentals_final(session_one,1,0);
  if public.load_fundamentals_snapshot('draft-unit','v1',0)->'progress'->'resumeStepId' is distinct from 'null'::jsonb then
    raise exception 'submitted final exposed a non-lesson resume step id';
  end if;
  perform public.start_fundamentals_final(session_two,'draft-unit','v1',4,0);
  for position in 0..11 loop perform public.save_fundamentals_final_response(session_two,position,position,jsonb_build_object('questionId','final-'||(position+1),'revision',1,'sourceVersion','v1'),'["a"]',0,gen_random_uuid(),position+1,11-position); end loop;
  perform public.finalize_fundamentals_final(session_two,12,0);
  perform public.start_fundamentals_final(session_three,'draft-unit','v1',6,0);
  for position in 0..11 loop perform public.save_fundamentals_final_response(session_three,position,position,jsonb_build_object('questionId','final-'||(position+1),'revision',1,'sourceVersion','v1'),case when position<10 then '["a"]'::jsonb else '["b"]'::jsonb end,0,gen_random_uuid(),100,position); end loop;
  perform public.finalize_fundamentals_final(session_three,12,0);
  v_history := public.load_fundamentals_history_summaries(
    jsonb_build_array(jsonb_build_object('unitId','draft-unit','contentVersion','v2')),
    0
  );
  if jsonb_array_length(v_history) <> 1
    or v_history->0->>'unitId' is distinct from 'draft-unit'
    or v_history->0->>'contentVersion' is distinct from 'v1'
    or v_history->0->>'latestScore' is distinct from '10'
    or v_history->0->>'requiredScore' is distinct from '10'
    or (select count(*) from jsonb_object_keys(v_history->0)) <> 10
    or not (v_history->0 ?& array[
      'unitId','contentVersion','completedSlides','totalSlides',
      'completedCheckpoints','totalCheckpoints','activeFinalSessionId','passedAt',
      'latestScore','requiredScore'
    ]) then
    raise exception 'history summary did not preserve the owner submitted score';
  end if;
  if public.load_fundamentals_history_summaries(
    jsonb_build_array(jsonb_build_object('unitId','draft-unit','contentVersion','v1')),
    0
  ) <> '[]'::jsonb then
    raise exception 'current fundamentals unit was returned as history';
  end if;
  begin
    perform public.load_fundamentals_history_summaries('[]'::jsonb,1);
    raise exception 'stale generation accepted for history summaries';
  exception when sqlstate 'PT409' then null;
  end;
end $test$;
reset role;
do $test$
begin
  if not exists(select 1 from public.fundamentals_final_sessions where session_id='11111111-1111-4111-8111-111111111111' and score=1 and required_score=10 and not passed) then raise exception 'unanswered answers were not wrong'; end if;
  if not exists(select 1 from public.fundamentals_final_sessions where session_id='22222222-2222-4222-8222-222222222222' and score=12 and passed) or not exists(select 1 from public.fundamentals_final_sessions where session_id='33333333-3333-4333-8333-333333333333' and score=10 and passed) then raise exception 'ceil 80 grade failed'; end if;
  if (select count(*) from public.learning_events where fundamentals_session_id is not null)<>36 then raise exception 'final events were not emitted once'; end if;
  if not exists(select 1 from public.learning_events where fundamentals_session_id is not null and duration_ms=42) then raise exception 'stored final duration was lost'; end if;
end $test$;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub','66666666-6666-4666-8666-666666666666','role','authenticated')::text,true);
do $test$
begin
  perform public.initialize_learning_state();
  if (public.load_fundamentals_snapshot('draft-unit','v1',0)->'sessions')<>'[]'::jsonb then raise exception 'owner isolation failed'; end if;
  if public.load_fundamentals_checkpoint_selection('draft-unit','v1','check-1',1,'v1',0) is not null then
    raise exception 'checkpoint history exposed another account response';
  end if;
  if public.load_fundamentals_history_summaries(
    jsonb_build_array(jsonb_build_object('unitId','draft-unit','contentVersion','v2')),
    0
  ) <> '[]'::jsonb then
    raise exception 'history summaries exposed another account records';
  end if;
end $test$;
reset role;
set local role anon;
do $test$
begin
  begin
    perform public.load_fundamentals_history_summaries('[]'::jsonb,0);
    raise exception 'anonymous history summary call was accepted';
  exception when insufficient_privilege then null;
  end;
end $test$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub','55555555-5555-4555-8555-555555555555','role','authenticated')::text,true);
do $test$ begin if public.reset_my_learning_data(0)<>1 then raise exception 'reset failed'; end if; end $test$;
reset role;
do $test$
begin
  if exists(select 1 from public.fundamentals_unit_progress where user_id='55555555-5555-4555-8555-555555555555') or exists(select 1 from public.fundamentals_final_sessions where user_id='55555555-5555-4555-8555-555555555555') then raise exception 'reset did not cascade lesson data'; end if;
end $test$;
commit;
