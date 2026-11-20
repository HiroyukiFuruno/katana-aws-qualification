-- #25 RPC。clientの正答・score・順序は採用せず、007のtrusted catalogだけで照合する。
create function public.require_fundamentals_catalog(p_unit_id text, p_content_version text)
returns public.published_fundamentals_catalogs
language plpgsql stable security definer set search_path = public, auth as $$
declare
  v_catalog public.published_fundamentals_catalogs%rowtype;
begin
  select * into v_catalog from public.published_fundamentals_catalogs
    where unit_id = p_unit_id and content_version = p_content_version;
  if not found or jsonb_array_length(v_catalog.plan) = 0
    or jsonb_array_length(v_catalog.final_questions) <> 12 then
    raise exception 'published fundamentals catalog is invalid' using errcode = '22023';
  end if;
  return v_catalog;
end $$;

create function public.fundamentals_canonical_selection(p_question jsonb, p_selected jsonb)
returns jsonb language plpgsql immutable security definer set search_path = public, auth as $$
declare
  v_result jsonb;
begin
  if p_selected is null
    or jsonb_typeof(p_selected) <> 'array'
    or exists (select 1 from jsonb_array_elements(p_selected) item where jsonb_typeof(item) <> 'string')
    or (select count(*) from jsonb_array_elements_text(p_selected)) <> (select count(distinct value) from jsonb_array_elements_text(p_selected))
    or exists (select 1 from jsonb_array_elements_text(p_selected) selected(value) where not exists (select 1 from jsonb_array_elements_text(p_question->'choiceIds') choice(id) where choice.id = selected.value)) then
    raise exception 'invalid fundamentals selection' using errcode = '22023';
  end if;
  select coalesce(jsonb_agg(choice.id order by choice.ordinality), '[]'::jsonb) into v_result
    from jsonb_array_elements_text(p_question->'choiceIds') with ordinality choice(id, ordinality)
    where choice.id in (select value from jsonb_array_elements_text(p_selected));
  return v_result;
end $$;

create function public.fundamentals_progress_snapshot(p_user_id uuid, p_unit_id text, p_content_version text)
returns jsonb language sql stable security definer set search_path = public, auth as $$
  select jsonb_build_object(
    'unitId', p_unit_id, 'contentVersion', p_content_version,
    'progress', coalesce((select jsonb_build_object(
      'completedSlideIds', completed_slide_ids, 'completedCheckpointIds', completed_checkpoint_ids,
      'furthestPlanPosition', furthest_plan_position, 'resumeStage', resume_stage, 'resumeStepId', resume_step_id,
      'activeFinalSessionId', active_final_session_id, 'passedFinalSessionId', passed_final_session_id,
      'passedAt', passed_at, 'revision', revision
    ) from public.fundamentals_unit_progress where user_id = p_user_id and unit_id = p_unit_id and content_version = p_content_version),
    jsonb_build_object('completedSlideIds', '[]'::jsonb, 'completedCheckpointIds', '[]'::jsonb, 'furthestPlanPosition', 0, 'resumeStage', 'slide', 'resumeStepId', null, 'activeFinalSessionId', null, 'passedFinalSessionId', null, 'passedAt', null, 'revision', 0)),
    'sessions', coalesce((select jsonb_agg(jsonb_build_object(
      'sessionId', session_id, 'position', position, 'state', state, 'responses', responses,
      'score', score, 'requiredScore', required_score, 'passed', passed, 'submittedAt', submitted_at, 'revision', revision
    ) order by started_at desc) from public.fundamentals_final_sessions where user_id = p_user_id and unit_id = p_unit_id and content_version = p_content_version), '[]'::jsonb)
  );
$$;

create function public.load_fundamentals_snapshot(p_unit_id text, p_content_version text, p_expected_generation bigint)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare
  v_user_id uuid := public.require_learning_generation(p_expected_generation);
begin
  perform public.require_fundamentals_catalog(p_unit_id, p_content_version);
  return public.fundamentals_progress_snapshot(v_user_id, p_unit_id, p_content_version);
end $$;

create function public.record_fundamentals_step(
  p_unit_id text, p_content_version text, p_kind text, p_step_id text, p_selected jsonb,
  p_expected_revision bigint, p_expected_generation bigint, p_receipt_id uuid, p_duration_ms integer default 0
)
returns jsonb language plpgsql security definer set search_path = public, auth, extensions as $$
declare
  v_user_id uuid := public.require_learning_generation(p_expected_generation);
  v_catalog public.published_fundamentals_catalogs%rowtype;
  v_progress public.fundamentals_unit_progress%rowtype;
  v_entry jsonb;
  v_checkpoint jsonb;
  v_selected jsonb;
  v_correct jsonb;
  v_next jsonb;
  v_position integer;
  v_hash bytea;
  v_slides jsonb;
  v_checkpoints jsonb;
  v_result jsonb := '{}'::jsonb;
  v_attempt_number integer;
  v_prior_incorrect_count integer;
  v_is_correct boolean;
  v_context jsonb;
begin
  if p_receipt_id is null or p_kind not in ('slide', 'checkpoint') or nullif(p_step_id, '') is null or p_duration_ms not between 0 and 86400000 then
    raise exception 'invalid fundamentals step' using errcode = '22023';
  end if;
  v_catalog := public.require_fundamentals_catalog(p_unit_id, p_content_version);
  select entry.value, (entry.value->>'position')::integer into v_entry, v_position
    from jsonb_array_elements(v_catalog.plan) entry(value)
    where entry.value->>'kind' = p_kind and entry.value->>'id' = p_step_id
      and coalesce((entry.value->>'required')::boolean, false);
  if v_position is null or (p_kind = 'slide' and p_selected is not null) then
    raise exception 'invalid fundamentals step' using errcode = '22023';
  end if;
  if p_kind = 'checkpoint' then
    v_checkpoint := v_entry->'question';
    if jsonb_typeof(v_checkpoint) <> 'object'
      or nullif(v_checkpoint->>'explanationRef', '') is null then
      raise exception 'invalid checkpoint catalog entry' using errcode = '22023';
    end if;
    v_selected := public.fundamentals_canonical_selection(v_checkpoint, p_selected);
    v_correct := public.fundamentals_canonical_selection(
      v_checkpoint, v_checkpoint->'correctChoiceIds'
    );
    if coalesce((v_checkpoint->>'requiredChoices')::integer, 0) < 1
      or jsonb_array_length(v_selected) <> (v_checkpoint->>'requiredChoices')::integer
      or jsonb_array_length(v_correct) <> (v_checkpoint->>'requiredChoices')::integer then
      raise exception 'checkpoint selection count is invalid' using errcode = '22023';
    end if;
    v_is_correct := v_selected = v_correct;
    v_context := jsonb_build_object(
      'kind', 'lesson-checkpoint', 'unitId', p_unit_id,
      'contentVersion', p_content_version, 'catalogHash', encode(v_catalog.content_hash, 'hex'),
      'stepId', p_step_id,
      'questionRef', jsonb_build_object(
        'questionId', v_checkpoint->>'questionId',
        'revision', (v_checkpoint->>'revision')::integer,
        'sourceVersion', v_checkpoint->>'sourceVersion'
      )
    );
    v_result := jsonb_build_object(
      'checkpointResult', jsonb_build_object(
        'isCorrect', v_is_correct, 'explanationRef', v_checkpoint->>'explanationRef'
      )
    );
  end if;
  v_hash := extensions.digest(jsonb_build_object(
    'unitId', p_unit_id, 'contentVersion', p_content_version, 'kind', p_kind,
    'stepId', p_step_id, 'selected', coalesce(v_selected, 'null'::jsonb),
    'durationMs', p_duration_ms
  )::text, 'sha256');
  insert into public.fundamentals_unit_progress(user_id, unit_id, content_version)
    values (v_user_id, p_unit_id, p_content_version) on conflict do nothing;
  select * into v_progress from public.fundamentals_unit_progress
    where user_id = v_user_id and unit_id = p_unit_id and content_version = p_content_version
    for update;
  if v_progress.last_mutation_id = p_receipt_id then
    if v_progress.last_mutation_hash is distinct from v_hash then
      raise exception 'fundamentals receipt reused with different payload' using errcode = '23505';
    end if;
    return public.fundamentals_progress_snapshot(v_user_id, p_unit_id, p_content_version) || v_result;
  end if;
  if v_progress.revision is distinct from p_expected_revision then
    raise exception 'stale fundamentals progress' using errcode = 'PT412';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_catalog.plan) prior(value)
    where coalesce((prior.value->>'required')::boolean, false)
      and (prior.value->>'position')::integer < v_position
      and (
        (prior.value->>'kind' = 'slide' and not (v_progress.completed_slide_ids ? (prior.value->>'id')))
        or (prior.value->>'kind' = 'checkpoint' and not (v_progress.completed_checkpoint_ids ? (prior.value->>'id')))
      )
  ) then
    raise exception 'fundamentals step is not yet reachable' using errcode = '22023';
  end if;
  select coalesce(jsonb_agg(value order by value), '[]'::jsonb) into v_slides
    from (
      select distinct value from jsonb_array_elements_text(
        v_progress.completed_slide_ids || case when p_kind = 'slide' then jsonb_build_array(p_step_id) else '[]'::jsonb end
      )
    ) valueset(value);
  select coalesce(jsonb_agg(value order by value), '[]'::jsonb) into v_checkpoints
    from (
      select distinct value from jsonb_array_elements_text(
        v_progress.completed_checkpoint_ids || case when p_kind = 'checkpoint' then jsonb_build_array(p_step_id) else '[]'::jsonb end
      )
    ) valueset(value);
  select entry.value into v_next
    from jsonb_array_elements(v_catalog.plan) entry(value)
    where coalesce((entry.value->>'required')::boolean, false)
      and (
        (entry.value->>'kind' = 'slide' and not (v_slides ? (entry.value->>'id')))
        or (entry.value->>'kind' = 'checkpoint' and not (v_checkpoints ? (entry.value->>'id')))
      )
    order by (entry.value->>'position')::integer
    limit 1;
  update public.fundamentals_unit_progress set
    completed_slide_ids = v_slides,
    completed_checkpoint_ids = v_checkpoints,
    furthest_plan_position = greatest(furthest_plan_position, v_position),
    resume_stage = coalesce(v_next->>'kind', 'final'),
    resume_step_id = v_next->>'id',
    revision = revision + 1,
    last_mutation_id = p_receipt_id,
    last_mutation_hash = v_hash,
    updated_at = clock_timestamp()
    where user_id = v_user_id and unit_id = p_unit_id and content_version = p_content_version;
  if p_kind = 'checkpoint' then
    select count(*)::integer + 1, count(*) filter (where not is_correct)::integer
      into v_attempt_number, v_prior_incorrect_count
      from public.learning_events
      where user_id = v_user_id
        and question_id = v_checkpoint->>'questionId'
        and question_revision = (v_checkpoint->>'revision')::integer;
    insert into public.learning_events (
      user_id, event_id, payload_hash, schema_version, certification_id, question_id,
      question_revision, source_version, category, mode, answered_at, selected, correct,
      is_correct, duration_ms, attempt_number, prior_incorrect_count, review_correct, reward,
      fundamentals_session_id, learning_context, selection_polarity, required_choices
    ) values (
      v_user_id, p_receipt_id, v_hash, 1, 'fundamentals', v_checkpoint->>'questionId',
      (v_checkpoint->>'revision')::integer, v_checkpoint->>'sourceVersion', v_checkpoint->>'category',
      'study', clock_timestamp(), v_selected, v_correct, v_is_correct, p_duration_ms,
      v_attempt_number, v_prior_incorrect_count, null, case when v_is_correct then 1 else 0 end,
      null, v_context, v_checkpoint->>'selectionPolarity', (v_checkpoint->>'requiredChoices')::smallint
    );
  end if;
  return public.fundamentals_progress_snapshot(v_user_id,p_unit_id,p_content_version)||v_result;
end $$;

create function public.start_fundamentals_final(
  p_session_id uuid,
  p_unit_id text,
  p_content_version text,
  p_expected_progress_revision bigint,
  p_expected_generation bigint
) returns jsonb
language plpgsql security definer set search_path = public, auth, extensions as $$
declare
  v_user_id uuid := public.require_learning_generation(p_expected_generation);
  v_catalog public.published_fundamentals_catalogs%rowtype;
  v_progress public.fundamentals_unit_progress%rowtype;
  v_session public.fundamentals_final_sessions%rowtype;
  v_start_hash bytea;
begin
  if p_session_id is null then
    raise exception 'final session id is required' using errcode = '22023';
  end if;
  v_catalog := public.require_fundamentals_catalog(p_unit_id, p_content_version);
  v_start_hash := extensions.digest(jsonb_build_object(
    'unitId', p_unit_id, 'contentVersion', p_content_version,
    'catalogHash', encode(v_catalog.content_hash, 'hex')
  )::text, 'sha256');
  insert into public.fundamentals_unit_progress(user_id, unit_id, content_version)
    values (v_user_id, p_unit_id, p_content_version) on conflict do nothing;
  select * into v_progress from public.fundamentals_unit_progress
    where user_id = v_user_id and unit_id = p_unit_id and content_version = p_content_version
    for update;
  select * into v_session from public.fundamentals_final_sessions
    where user_id = v_user_id and session_id = p_session_id for update;
  if found then
    if v_session.unit_id is distinct from p_unit_id
      or v_session.content_version is distinct from p_content_version
      or v_session.start_hash is distinct from v_start_hash then
      raise exception 'final session id collision' using errcode = '23505';
    end if;
    return public.fundamentals_progress_snapshot(v_user_id, p_unit_id, p_content_version);
  end if;
  select * into v_session from public.fundamentals_final_sessions
    where user_id = v_user_id and unit_id = p_unit_id and content_version = p_content_version
      and state = 'draft' for update;
  if found then
    return public.fundamentals_progress_snapshot(v_user_id, p_unit_id, p_content_version);
  end if;
  if v_progress.revision is distinct from p_expected_progress_revision then
    raise exception 'stale fundamentals progress' using errcode = 'PT412';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_catalog.plan) entry(value)
    where coalesce((entry.value->>'required')::boolean, false)
      and (
        (entry.value->>'kind' = 'slide' and not (v_progress.completed_slide_ids ? (entry.value->>'id')))
        or (entry.value->>'kind' = 'checkpoint' and not (v_progress.completed_checkpoint_ids ? (entry.value->>'id')))
      )
  ) then
    raise exception 'fundamentals required steps are incomplete' using errcode = '22023';
  end if;
  insert into public.fundamentals_final_sessions (
    user_id, session_id, unit_id, content_version, catalog_hash, start_hash, question_order, required_score
  ) values (
    v_user_id, p_session_id, p_unit_id, p_content_version, v_catalog.content_hash,
    v_start_hash, v_catalog.final_questions, ceil(jsonb_array_length(v_catalog.final_questions) * 0.8)::integer
  );
  update public.fundamentals_unit_progress set
    active_final_session_id = p_session_id,
    resume_stage = 'final',
    resume_step_id = null,
    revision = revision + 1,
    updated_at = clock_timestamp()
    where user_id = v_user_id and unit_id = p_unit_id and content_version = p_content_version;
  return public.fundamentals_progress_snapshot(v_user_id, p_unit_id, p_content_version);
end $$;

create function public.save_fundamentals_final_response(
  p_session_id uuid,
  p_expected_revision bigint,
  p_position integer,
  p_question_ref jsonb,
  p_selected jsonb,
  p_expected_generation bigint,
  p_receipt_id uuid,
  p_duration_ms integer default 0,
  p_cursor_position integer default null
) returns jsonb
language plpgsql security definer set search_path = public, auth, extensions as $$
declare
  v_user_id uuid := public.require_learning_generation(p_expected_generation);
  v_session public.fundamentals_final_sessions%rowtype;
  v_question jsonb;
  v_expected_ref jsonb;
  v_selected jsonb;
  v_receipt_hash bytea;
begin
  if p_receipt_id is null or p_position is null or p_duration_ms not between 0 and 86400000 then
    raise exception 'invalid final response receipt or duration' using errcode = '22023';
  end if;
  select * into v_session from public.fundamentals_final_sessions
    where user_id = v_user_id and session_id = p_session_id for update;
  if not found or v_session.state <> 'draft' then
    raise exception 'final session is not an active draft' using errcode = '22023';
  end if;
  if p_position not between 0 and jsonb_array_length(v_session.question_order) - 1
    or (
      p_cursor_position is not null
      and p_cursor_position not between 0 and jsonb_array_length(v_session.question_order) - 1
    ) then
    raise exception 'invalid final response position' using errcode = '22023';
  end if;
  v_question := v_session.question_order->p_position;
  v_expected_ref := jsonb_build_object(
    'questionId', v_question->>'questionId',
    'revision', (v_question->>'revision')::integer,
    'sourceVersion', v_question->>'sourceVersion'
  );
  if p_question_ref is distinct from v_expected_ref then
    raise exception 'final response question does not match fixed order' using errcode = '22023';
  end if;
  v_selected := public.fundamentals_canonical_selection(v_question, p_selected);
  v_receipt_hash := extensions.digest(jsonb_build_object(
    'sessionId', p_session_id, 'position', p_position, 'questionRef', v_expected_ref,
    'selected', v_selected, 'durationMs', p_duration_ms,
    'cursorPosition', coalesce(p_cursor_position, p_position)
  )::text, 'sha256');
  if v_session.last_response_receipt_id = p_receipt_id then
    if v_session.last_response_receipt_hash is distinct from v_receipt_hash then
      raise exception 'final response receipt reused with different payload' using errcode = '23505';
    end if;
    return public.fundamentals_progress_snapshot(v_user_id, v_session.unit_id, v_session.content_version);
  end if;
  if v_session.revision is distinct from p_expected_revision then
    raise exception 'stale final session' using errcode = 'PT412';
  end if;
  update public.fundamentals_final_sessions set
    responses = jsonb_set(responses, array[p_position::text], jsonb_build_object(
      'questionRef', v_expected_ref, 'selected', v_selected,
      'selectedAt', clock_timestamp(), 'durationMs', p_duration_ms
    )),
    position = coalesce(p_cursor_position, p_position),
    revision = revision + 1,
    last_response_receipt_id = p_receipt_id,
    last_response_receipt_hash = v_receipt_hash
    where user_id = v_user_id and session_id = p_session_id;
  return public.fundamentals_progress_snapshot(v_user_id, v_session.unit_id, v_session.content_version);
end $$;

create function public.finalize_fundamentals_final(p_session_id uuid, p_expected_revision bigint, p_expected_generation bigint)
returns jsonb language plpgsql security definer set search_path = public, auth, extensions as $$
declare
  v_user_id uuid := public.require_learning_generation(p_expected_generation);
  v_session public.fundamentals_final_sessions%rowtype;
  v_progress public.fundamentals_unit_progress%rowtype;
  v_question jsonb;
  v_selected jsonb;
  v_correct jsonb;
  v_score integer := 0;
  v_position integer;
  v_received_at timestamptz := clock_timestamp();
  v_submission_hash bytea;
  v_attempt_number integer;
  v_prior_incorrect_count integer;
  v_is_correct boolean;
  v_context jsonb;
  v_duration integer;
begin
  select * into v_session from public.fundamentals_final_sessions
    where user_id = v_user_id and session_id = p_session_id;
  if not found then
    raise exception 'final session not found' using errcode = '22023';
  end if;
  if v_session.state = 'submitted' then
    return public.fundamentals_progress_snapshot(v_user_id, v_session.unit_id, v_session.content_version);
  end if;
  select * into v_progress from public.fundamentals_unit_progress
    where user_id = v_user_id and unit_id = v_session.unit_id and content_version = v_session.content_version
    for update;
  if not found or v_progress.active_final_session_id is distinct from p_session_id then
    raise exception 'final session is not the active unit session' using errcode = '22023';
  end if;
  select * into v_session from public.fundamentals_final_sessions
    where user_id = v_user_id and session_id = p_session_id for update;
  if not found or v_session.state <> 'draft' then
    raise exception 'final session is not an active draft' using errcode = '22023';
  end if;
  if v_session.revision is distinct from p_expected_revision then
    raise exception 'stale final session' using errcode = 'PT412';
  end if;
  for v_position in 0..jsonb_array_length(v_session.question_order)-1 loop
    v_question := v_session.question_order->v_position;
    v_selected := public.fundamentals_canonical_selection(
      v_question, coalesce(v_session.responses->(v_position::text)->'selected', '[]'::jsonb)
    );
    v_correct := public.fundamentals_canonical_selection(v_question, v_question->'correctChoiceIds');
    if v_selected = v_correct then
      v_score := v_score + 1;
    end if;
  end loop;
  v_submission_hash:=extensions.digest(jsonb_build_object('catalogHash',encode(v_session.catalog_hash,'hex'),'responses',v_session.responses,'score',v_score,'requiredScore',v_session.required_score)::text,'sha256');
  update public.fundamentals_final_sessions set state='submitted',score=v_score,passed=v_score>=v_session.required_score,submitted_at=v_received_at,submitted_received_at=v_received_at,submission_hash=v_submission_hash,revision=revision+1 where user_id=v_user_id and session_id=p_session_id;
  for v_position in 0..jsonb_array_length(v_session.question_order)-1 loop
    v_question := v_session.question_order->v_position;
    v_selected := public.fundamentals_canonical_selection(
      v_question, coalesce(v_session.responses->(v_position::text)->'selected', '[]'::jsonb)
    );
    v_correct := public.fundamentals_canonical_selection(v_question, v_question->'correctChoiceIds');
    v_is_correct := v_selected = v_correct;
    v_duration := coalesce((v_session.responses->(v_position::text)->>'durationMs')::integer, 0);
    v_context:=jsonb_build_object('kind','lesson-final','unitId',v_session.unit_id,'contentVersion',v_session.content_version,'catalogHash',encode(v_session.catalog_hash,'hex'),'sessionId',p_session_id,'position',v_position,'questionRef',jsonb_build_object('questionId',v_question->>'questionId','revision',(v_question->>'revision')::integer,'sourceVersion',v_question->>'sourceVersion'));
    select count(*)::integer+1,count(*) filter(where not is_correct)::integer into v_attempt_number,v_prior_incorrect_count from public.learning_events where user_id=v_user_id and question_id=v_question->>'questionId' and question_revision=(v_question->>'revision')::integer;
    insert into public.learning_events(user_id,event_id,payload_hash,schema_version,certification_id,question_id,question_revision,source_version,category,mode,answered_at,selected,correct,is_correct,duration_ms,attempt_number,prior_incorrect_count,review_correct,reward,fundamentals_session_id,learning_context,selection_polarity,required_choices) values(v_user_id,gen_random_uuid(),extensions.digest(jsonb_build_object('sessionId',p_session_id,'position',v_position,'selected',v_selected,'durationMs',v_duration)::text,'sha256'),1,'fundamentals',v_question->>'questionId',(v_question->>'revision')::integer,v_question->>'sourceVersion',v_question->>'category','study',v_received_at,v_selected,v_correct,v_is_correct,v_duration,v_attempt_number,v_prior_incorrect_count,null,case when v_is_correct then 1 else 0 end,p_session_id,v_context,v_question->>'selectionPolarity',(v_question->>'requiredChoices')::smallint);
  end loop;
  update public.fundamentals_unit_progress set active_final_session_id=null,resume_stage='result',resume_step_id=null,passed_final_session_id=case when v_score>=v_session.required_score then p_session_id else passed_final_session_id end,passed_at=case when v_score>=v_session.required_score then v_received_at else passed_at end,revision=revision+1,updated_at=v_received_at where user_id=v_user_id and unit_id=v_session.unit_id and content_version=v_session.content_version;
  return public.fundamentals_progress_snapshot(v_user_id,v_session.unit_id,v_session.content_version);
end $$;

create or replace function public.reset_my_learning_data(
  p_expected_generation bigint
) returns bigint
language plpgsql security definer set search_path = public, auth as $$
declare
  v_user_id uuid := public.require_learning_user();
  v_generation bigint;
begin
  if p_expected_generation is null or p_expected_generation < 0 then
    raise exception 'invalid learning generation' using errcode = '22023';
  end if;
  select generation into v_generation from public.learning_state
    where user_id = v_user_id for update;
  if not found then
    raise exception 'learning state is not initialized' using errcode = '22023';
  end if;
  if v_generation <> p_expected_generation then
    raise exception 'stale learning state' using errcode = 'PT409';
  end if;
  delete from public.fundamentals_unit_progress where user_id = v_user_id;
  delete from public.fundamentals_final_sessions where user_id = v_user_id;
  delete from public.learning_events where user_id = v_user_id;
  delete from public.exam_sessions where user_id = v_user_id;
  delete from public.earned_certifications where user_id = v_user_id;
  delete from public.assessment_answers where user_id = v_user_id;
  delete from public.migration_manifests where user_id = v_user_id;
  delete from public.roadmap_profiles where user_id = v_user_id;
  update public.learning_state set generation = generation + 1
    where user_id = v_user_id returning generation into v_generation;
  return v_generation;
end $$;

create function public.load_fundamentals_progress_summaries(
  p_units jsonb,
  p_expected_generation bigint
) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare
  v_user_id uuid := public.require_learning_generation(p_expected_generation);
begin
  if jsonb_typeof(p_units) <> 'array'
    or exists (
      select 1 from jsonb_array_elements(p_units) unit(value)
      where jsonb_typeof(unit.value) <> 'object'
        or unit.value <> jsonb_build_object(
          'unitId', unit.value->>'unitId', 'contentVersion', unit.value->>'contentVersion'
        )
        or nullif(unit.value->>'unitId', '') is null
        or nullif(unit.value->>'contentVersion', '') is null
    )
    or exists (
      select 1 from jsonb_array_elements(p_units) unit(value)
      group by unit.value->>'unitId', unit.value->>'contentVersion' having count(*) > 1
    )
    or exists (
      select 1 from jsonb_array_elements(p_units) unit(value)
      where not exists (
        select 1 from public.published_fundamentals_catalogs catalog
        where catalog.unit_id = unit.value->>'unitId'
          and catalog.content_version = unit.value->>'contentVersion'
      )
    ) then
    raise exception 'invalid fundamentals progress summary references' using errcode = '22023';
  end if;

  return coalesce((
    select jsonb_agg(summary.value order by summary.ordinality)
    from (
      select requested.ordinality, jsonb_build_object(
      'unitId', requested.value->>'unitId',
      'contentVersion', requested.value->>'contentVersion',
      'completedSlides', coalesce(jsonb_array_length(progress.completed_slide_ids), 0),
      'totalSlides', count(*) filter (where plan.value->>'kind' = 'slide'),
      'completedCheckpoints', coalesce(jsonb_array_length(progress.completed_checkpoint_ids), 0),
      'totalCheckpoints', count(*) filter (where plan.value->>'kind' = 'checkpoint'),
      'activeFinalSessionId', progress.active_final_session_id,
      'passedAt', progress.passed_at,
      'latestScore', latest.score,
      'requiredScore', latest.required_score
      ) as value
      from jsonb_array_elements(p_units) with ordinality requested(value, ordinality)
    join public.published_fundamentals_catalogs catalog
      on catalog.unit_id = requested.value->>'unitId'
      and catalog.content_version = requested.value->>'contentVersion'
    left join public.fundamentals_unit_progress progress
      on progress.user_id = v_user_id and progress.unit_id = catalog.unit_id
      and progress.content_version = catalog.content_version
    left join lateral (
      select session.score, session.required_score
      from public.fundamentals_final_sessions session
      where session.user_id = v_user_id and session.unit_id = catalog.unit_id
        and session.content_version = catalog.content_version and session.state = 'submitted'
      order by session.submitted_at desc, session.session_id desc limit 1
    ) latest on true
    cross join lateral jsonb_array_elements(catalog.plan) plan(value)
      group by requested.value, requested.ordinality, progress.completed_slide_ids,
        progress.completed_checkpoint_ids, progress.active_final_session_id, progress.passed_at,
        latest.score, latest.required_score
    ) summary
  ), '[]'::jsonb);
end $$;

revoke all on function public.require_fundamentals_catalog(text,text),public.fundamentals_canonical_selection(jsonb,jsonb),public.fundamentals_progress_snapshot(uuid,text,text) from public,anon,authenticated;
revoke all on function public.load_fundamentals_snapshot(text,text,bigint),public.record_fundamentals_step(text,text,text,text,jsonb,bigint,bigint,uuid,integer),public.start_fundamentals_final(uuid,text,text,bigint,bigint),public.save_fundamentals_final_response(uuid,bigint,integer,jsonb,jsonb,bigint,uuid,integer,integer),public.finalize_fundamentals_final(uuid,bigint,bigint) from public,anon;
grant execute on function public.load_fundamentals_snapshot(text,text,bigint),public.record_fundamentals_step(text,text,text,text,jsonb,bigint,bigint,uuid,integer),public.start_fundamentals_final(uuid,text,text,bigint,bigint),public.save_fundamentals_final_response(uuid,bigint,integer,jsonb,jsonb,bigint,uuid,integer,integer),public.finalize_fundamentals_final(uuid,bigint,bigint) to authenticated;
revoke all on function public.load_fundamentals_progress_summaries(jsonb,bigint) from public,anon;
grant execute on function public.load_fundamentals_progress_summaries(jsonb,bigint) to authenticated;
