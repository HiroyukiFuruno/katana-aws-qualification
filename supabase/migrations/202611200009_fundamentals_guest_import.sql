-- #25 の明示的ゲスト移行。payload の採点結果や順序は採用せず、007 の catalog を唯一の正本とする。

create function public.fundamentals_import_question_matches(
  p_question jsonb,
  p_reference jsonb
) returns boolean
language sql immutable security definer set search_path = public, auth as $$
  select p_reference = jsonb_build_object(
    'questionId', p_question->>'questionId',
    'revision', (p_question->>'revision')::integer,
    'sourceVersion', p_question->>'sourceVersion'
  );
$$;

create function public.fundamentals_import_response(
  p_question jsonb,
  p_response jsonb
) returns jsonb
language plpgsql immutable security definer set search_path = public, auth as $$
declare
  v_selected jsonb;
  v_selected_at timestamptz;
  v_duration integer;
begin
  if jsonb_typeof(p_response) <> 'object'
    or exists (
      select 1 from jsonb_object_keys(p_response) key
      where key not in ('questionRef', 'selected', 'selectedAt', 'durationMs')
    )
    or not public.fundamentals_import_question_matches(p_question, p_response->'questionRef')
    or jsonb_typeof(p_response->'selected') <> 'array'
    or jsonb_typeof(p_response->'selectedAt') <> 'string'
    or nullif(p_response->>'selectedAt', '') is null
    or nullif(p_response->>'durationMs', '') is null then
    raise exception 'invalid imported final response' using errcode = '22023';
  end if;

  v_selected := public.fundamentals_canonical_selection(p_question, p_response->'selected');
  v_selected_at := (p_response->>'selectedAt')::timestamptz;
  v_duration := (p_response->>'durationMs')::integer;
  if not isfinite(v_selected_at)
    or v_duration not between 0 and 86400000
    or jsonb_array_length(v_selected) > (p_question->>'requiredChoices')::integer then
    raise exception 'invalid imported final duration' using errcode = '22023';
  end if;

  return jsonb_build_object(
    'questionRef', p_response->'questionRef',
    'selected', v_selected,
    'selectedAt', v_selected_at,
    'durationMs', v_duration
  );
end $$;

create function public.import_fundamentals_unit(
  p_expected_generation bigint,
  p_manifest_id uuid,
  p_source_row_id text,
  p_payload jsonb
) returns jsonb
language plpgsql security definer set search_path = public, auth, extensions as $$
declare
  v_user_id uuid := public.require_learning_generation(p_expected_generation);
  v_manifest_status text;
  v_manifest_source text;
  v_existing_item public.migration_items%rowtype;
  v_payload_hash bytea;
  v_catalog public.published_fundamentals_catalogs%rowtype;
  v_progress public.fundamentals_unit_progress%rowtype;
  v_unit_id text;
  v_content_version text;
  v_source_slides jsonb;
  v_source_checkpoints jsonb;
  v_slides jsonb;
  v_checkpoints jsonb;
  v_receipt jsonb;
  v_checkpoint jsonb;
  v_selected jsonb;
  v_correct jsonb;
  v_event_hash bytea;
  v_event_id uuid;
  v_answered_at timestamptz;
  v_duration integer;
  v_attempt_number integer;
  v_prior_incorrect_count integer;
  v_active jsonb;
  v_submitted jsonb;
  v_session public.fundamentals_final_sessions%rowtype;
  v_session_id uuid;
  v_question jsonb;
  v_response jsonb;
  v_responses jsonb;
  v_position integer;
  v_score integer;
  v_event_ids jsonb;
  v_started_at timestamptz;
  v_submitted_at timestamptz;
  v_start_hash bytea;
  v_submission_hash bytea;
  v_context jsonb;
  v_imported_passed_session uuid;
  v_imported_passed_at timestamptz;
begin
  if jsonb_typeof(p_payload) <> 'object'
    or nullif(p_source_row_id, '') is null
    or length(p_source_row_id) > 200
    or exists (
      select 1 from jsonb_object_keys(p_payload) key
      where key not in (
        'unitId', 'contentVersion', 'completedSlideIds', 'completedCheckpointIds',
        'furthestPlanPosition', 'resumeStage', 'resumeStepId', 'checkpointReceipts',
        'activeFinal', 'submittedFinals'
      )
    ) then
    raise exception 'invalid fundamentals import payload' using errcode = '22023';
  end if;

  v_unit_id := nullif(p_payload->>'unitId', '');
  v_content_version := nullif(p_payload->>'contentVersion', '');
  if v_unit_id is null or v_content_version is null
    or p_source_row_id is distinct from v_unit_id || ':' || v_content_version
    or jsonb_typeof(p_payload->'completedSlideIds') <> 'array'
    or jsonb_typeof(p_payload->'completedCheckpointIds') <> 'array'
    or jsonb_typeof(p_payload->'checkpointReceipts') <> 'array'
    or jsonb_typeof(p_payload->'submittedFinals') <> 'array'
    or coalesce((p_payload->>'furthestPlanPosition')::integer, -1) < 0
    or nullif(p_payload->>'resumeStage', '') not in ('slide', 'checkpoint', 'final', 'result') then
    raise exception 'invalid fundamentals import payload' using errcode = '22023';
  end if;

  v_payload_hash := extensions.digest(p_payload::text, 'sha256');
  select status, source_name into v_manifest_status, v_manifest_source
    from public.migration_manifests
    where user_id = v_user_id and manifest_id = p_manifest_id
    for update;
  if v_manifest_status is distinct from 'started'
    or v_manifest_source is distinct from 'fundamentals-progress-local-storage' then
    raise exception 'invalid migration manifest item' using errcode = '22023';
  end if;

  select * into v_existing_item
    from public.migration_items
    where user_id = v_user_id and manifest_id = p_manifest_id and source_row_id = p_source_row_id
    for update;
  if found then
    if v_existing_item.outcome is distinct from 'accepted'
      or v_existing_item.import_kind is distinct from 'fundamentals-unit'
      or v_existing_item.payload_hash is distinct from v_payload_hash then
      raise exception 'fundamentals migration row was reused' using errcode = '23505';
    end if;
    return public.fundamentals_progress_snapshot(v_user_id, v_unit_id, v_content_version);
  end if;

  v_catalog := public.require_fundamentals_catalog(v_unit_id, v_content_version);
  v_source_slides := p_payload->'completedSlideIds';
  v_source_checkpoints := p_payload->'completedCheckpointIds';
  if exists (
    select 1 from jsonb_array_elements_text(v_source_slides) item(id)
    where not exists (
      select 1 from jsonb_array_elements(v_catalog.plan) plan(value)
      where plan.value->>'kind' = 'slide' and plan.value->>'id' = item.id
    )
  ) or exists (
    select 1 from jsonb_array_elements_text(v_source_checkpoints) item(id)
    where not exists (
      select 1 from jsonb_array_elements(v_catalog.plan) plan(value)
      where plan.value->>'kind' = 'checkpoint' and plan.value->>'id' = item.id
    )
  ) then
    raise exception 'imported fundamentals completion is not in catalog' using errcode = '22023';
  end if;

  insert into public.fundamentals_unit_progress(user_id, unit_id, content_version)
    values (v_user_id, v_unit_id, v_content_version)
    on conflict do nothing;
  select * into v_progress
    from public.fundamentals_unit_progress
    where user_id = v_user_id and unit_id = v_unit_id and content_version = v_content_version
    for update;

  v_active := p_payload->'activeFinal';
  if v_active is not null and v_active <> 'null'::jsonb
    and (
      jsonb_typeof(v_active) <> 'object'
      or exists (
        select 1 from jsonb_object_keys(v_active) key
        where key not in ('sessionId', 'startedAt', 'position', 'questionOrder', 'responses')
      )
    ) then
    raise exception 'invalid imported active final' using errcode = '22023';
  end if;
  if v_progress.active_final_session_id is not null
    and v_active is not null and v_active <> 'null'::jsonb
    and v_progress.active_final_session_id::text is distinct from v_active->>'sessionId' then
    raise exception 'member and guest active finals conflict' using errcode = 'PT412';
  end if;

  select coalesce(jsonb_agg(id order by id), '[]'::jsonb) into v_slides
    from (
      select distinct value as id
      from jsonb_array_elements_text(v_progress.completed_slide_ids || v_source_slides)
    ) ids;
  select coalesce(jsonb_agg(id order by id), '[]'::jsonb) into v_checkpoints
    from (
      select distinct value as id
      from jsonb_array_elements_text(v_progress.completed_checkpoint_ids || v_source_checkpoints)
    ) ids;

  for v_receipt in select value from jsonb_array_elements(p_payload->'checkpointReceipts') loop
    if jsonb_typeof(v_receipt) <> 'object'
      or exists (
        select 1 from jsonb_object_keys(v_receipt) key
        where key not in ('stepId', 'receiptId', 'questionRef', 'selected', 'answeredAt', 'durationMs')
      )
      or nullif(v_receipt->>'stepId', '') is null
      or nullif(v_receipt->>'receiptId', '') is null
      or jsonb_typeof(v_receipt->'answeredAt') <> 'string'
      or nullif(v_receipt->>'answeredAt', '') is null
      or nullif(v_receipt->>'durationMs', '') is null then
      raise exception 'invalid checkpoint receipt' using errcode = '22023';
    end if;
    v_event_id := (v_receipt->>'receiptId')::uuid;
    v_answered_at := (v_receipt->>'answeredAt')::timestamptz;
    v_duration := (v_receipt->>'durationMs')::integer;
    select plan.value->'question' into v_checkpoint
      from jsonb_array_elements(v_catalog.plan) plan(value)
      where plan.value->>'kind' = 'checkpoint'
        and plan.value->>'id' = v_receipt->>'stepId';
    if not isfinite(v_answered_at)
      or v_checkpoint is null
      or not public.fundamentals_import_question_matches(v_checkpoint, v_receipt->'questionRef')
      or v_duration not between 0 and 86400000 then
      raise exception 'checkpoint receipt does not match catalog' using errcode = '22023';
    end if;
    v_selected := public.fundamentals_canonical_selection(v_checkpoint, v_receipt->'selected');
    v_correct := public.fundamentals_canonical_selection(v_checkpoint, v_checkpoint->'correctChoiceIds');
    if jsonb_array_length(v_selected) <> (v_checkpoint->>'requiredChoices')::integer then
      raise exception 'checkpoint receipt selection count is invalid' using errcode = '22023';
    end if;
    v_event_hash := extensions.digest(jsonb_build_object(
      'kind', 'lesson-checkpoint', 'unitId', v_unit_id, 'contentVersion', v_content_version,
      'stepId', v_receipt->>'stepId', 'receiptId', v_event_id, 'selected', v_selected,
      'answeredAt', v_answered_at, 'durationMs', v_duration
    )::text, 'sha256');
    select count(*)::integer + 1,
      count(*) filter (where not is_correct)::integer
      into v_attempt_number, v_prior_incorrect_count
      from public.learning_events
      where user_id = v_user_id
        and question_id = v_checkpoint->>'questionId'
        and question_revision = (v_checkpoint->>'revision')::integer;
    v_context := jsonb_build_object(
      'kind', 'lesson-checkpoint', 'unitId', v_unit_id,
      'contentVersion', v_content_version, 'catalogHash', encode(v_catalog.content_hash, 'hex'),
      'stepId', v_receipt->>'stepId', 'questionRef', v_receipt->'questionRef'
    );
    insert into public.learning_events (
      user_id, event_id, payload_hash, schema_version, certification_id, question_id,
      question_revision, source_version, category, mode, answered_at, selected, correct,
      is_correct, duration_ms, attempt_number, prior_incorrect_count, review_correct, reward,
      fundamentals_session_id, learning_context, selection_polarity, required_choices
    ) values (
      v_user_id, v_event_id, v_event_hash, 1, 'fundamentals', v_checkpoint->>'questionId',
      (v_checkpoint->>'revision')::integer, v_checkpoint->>'sourceVersion', v_checkpoint->>'category',
      'study', v_answered_at, v_selected, v_correct, v_selected = v_correct, v_duration,
      v_attempt_number, v_prior_incorrect_count, null, case when v_selected = v_correct then 1 else 0 end,
      null, v_context, v_checkpoint->>'selectionPolarity', (v_checkpoint->>'requiredChoices')::smallint
    ) on conflict (user_id, event_id) do nothing;
    if (select payload_hash from public.learning_events where user_id = v_user_id and event_id = v_event_id)
      is distinct from v_event_hash then
      raise exception 'checkpoint receipt UUID collision' using errcode = '23505';
    end if;
  end loop;

  if v_active is not null and v_active <> 'null'::jsonb then
    v_session_id := (v_active->>'sessionId')::uuid;
    if v_session_id is null
      or jsonb_typeof(v_active->'startedAt') <> 'string'
      or nullif(v_active->>'startedAt', '') is null
      or jsonb_typeof(v_active->'questionOrder') <> 'array'
      or jsonb_array_length(v_active->'questionOrder') <> jsonb_array_length(v_catalog.final_questions)
      or jsonb_typeof(v_active->'responses') <> 'object'
      or coalesce((v_active->>'position')::integer, -1) not between 0 and jsonb_array_length(v_catalog.final_questions) - 1 then
      raise exception 'invalid imported active final' using errcode = '22023';
    end if;
    for v_position in 0..jsonb_array_length(v_catalog.final_questions) - 1 loop
      if (v_active->'questionOrder'->v_position->>'position')::integer is distinct from v_position
        or not public.fundamentals_import_question_matches(
          v_catalog.final_questions->v_position,
          (v_active->'questionOrder'->v_position) - 'position'
        ) then
        raise exception 'active final question order does not match catalog' using errcode = '22023';
      end if;
    end loop;
    v_responses := '{}'::jsonb;
    for v_position, v_response in
      select key::integer, value from jsonb_each(v_active->'responses') order by key::integer loop
      if v_position not between 0 and jsonb_array_length(v_catalog.final_questions) - 1 then
        raise exception 'active final response position is invalid' using errcode = '22023';
      end if;
      v_responses := jsonb_set(
        v_responses, array[v_position::text],
        public.fundamentals_import_response(v_catalog.final_questions->v_position, v_response)
      );
    end loop;
    v_started_at := (v_active->>'startedAt')::timestamptz;
    if not isfinite(v_started_at) then
      raise exception 'active final start time is invalid' using errcode = '22023';
    end if;
    v_start_hash := extensions.digest(jsonb_build_object(
      'unitId', v_unit_id, 'contentVersion', v_content_version,
      'catalogHash', encode(v_catalog.content_hash, 'hex')
    )::text, 'sha256');
    insert into public.fundamentals_final_sessions (
      user_id, session_id, unit_id, content_version, catalog_hash, start_hash, question_order,
      responses, position, required_score, started_at
    ) values (
      v_user_id, v_session_id, v_unit_id, v_content_version, v_catalog.content_hash, v_start_hash,
      v_catalog.final_questions, v_responses, (v_active->>'position')::integer,
      ceil(jsonb_array_length(v_catalog.final_questions) * 0.8)::integer, v_started_at
    ) on conflict (user_id, session_id) do nothing;
    select * into v_session from public.fundamentals_final_sessions
      where user_id = v_user_id and session_id = v_session_id for update;
    if v_session.state <> 'draft'
      or v_session.question_order is distinct from v_catalog.final_questions
      or v_session.responses is distinct from v_responses
      or v_session.position is distinct from (v_active->>'position')::integer then
      raise exception 'active final session UUID collision' using errcode = '23505';
    end if;
    v_progress.active_final_session_id := v_session_id;
  end if;

  for v_submitted in select value from jsonb_array_elements(p_payload->'submittedFinals') loop
    if jsonb_typeof(v_submitted) <> 'object'
      or exists (
        select 1 from jsonb_object_keys(v_submitted) key
        where key not in ('sessionId', 'startedAt', 'questionOrder', 'responses', 'submittedAt', 'eventIds')
      )
      or nullif(v_submitted->>'sessionId', '') is null
      or jsonb_typeof(v_submitted->'startedAt') <> 'string'
      or nullif(v_submitted->>'startedAt', '') is null
      or jsonb_typeof(v_submitted->'submittedAt') <> 'string'
      or nullif(v_submitted->>'submittedAt', '') is null
      or jsonb_typeof(v_submitted->'questionOrder') <> 'array'
      or jsonb_typeof(v_submitted->'responses') <> 'object'
      or jsonb_typeof(v_submitted->'eventIds') <> 'array' then
      raise exception 'invalid imported submitted final' using errcode = '22023';
    end if;
    v_session_id := (v_submitted->>'sessionId')::uuid;
    v_started_at := (v_submitted->>'startedAt')::timestamptz;
    v_submitted_at := (v_submitted->>'submittedAt')::timestamptz;
    if not isfinite(v_started_at) or not isfinite(v_submitted_at) or v_submitted_at < v_started_at then
      raise exception 'submitted final precedes its start' using errcode = '22023';
    end if;
    if jsonb_array_length(v_submitted->'questionOrder') <> jsonb_array_length(v_catalog.final_questions)
      or jsonb_array_length(v_submitted->'eventIds') <> jsonb_array_length(v_catalog.final_questions) then
      raise exception 'submitted final count does not match catalog' using errcode = '22023';
    end if;
    v_responses := '{}'::jsonb;
    v_score := 0;
    for v_position in 0..jsonb_array_length(v_catalog.final_questions) - 1 loop
      v_question := v_catalog.final_questions->v_position;
      if (v_submitted->'questionOrder'->v_position->>'position')::integer is distinct from v_position
        or not public.fundamentals_import_question_matches(
          v_question, (v_submitted->'questionOrder'->v_position) - 'position'
        ) then
        raise exception 'submitted final question order does not match catalog' using errcode = '22023';
      end if;
      if v_submitted->'responses' ? v_position::text then
        v_response := public.fundamentals_import_response(v_question, v_submitted->'responses'->v_position::text);
      else
        v_response := jsonb_build_object(
          'questionRef', jsonb_build_object('questionId', v_question->>'questionId', 'revision', (v_question->>'revision')::integer, 'sourceVersion', v_question->>'sourceVersion'),
          'selected', '[]'::jsonb, 'selectedAt', v_submitted_at, 'durationMs', 0
        );
      end if;
      v_selected := v_response->'selected';
      v_correct := public.fundamentals_canonical_selection(v_question, v_question->'correctChoiceIds');
      if v_selected = v_correct then v_score := v_score + 1; end if;
      v_responses := jsonb_set(v_responses, array[v_position::text], v_response);
    end loop;
    v_event_ids := v_submitted->'eventIds';
    if exists (
      select 1 from jsonb_array_elements_text(v_event_ids) event_id
      group by event_id having count(*) > 1
    ) then
      raise exception 'submitted final event UUID is repeated' using errcode = '22023';
    end if;
    v_start_hash := extensions.digest(jsonb_build_object(
      'unitId', v_unit_id, 'contentVersion', v_content_version,
      'catalogHash', encode(v_catalog.content_hash, 'hex')
    )::text, 'sha256');
    v_submission_hash := extensions.digest(jsonb_build_object(
      'catalogHash', encode(v_catalog.content_hash, 'hex'), 'responses', v_responses,
      'eventIds', v_event_ids, 'score', v_score,
      'requiredScore', ceil(jsonb_array_length(v_catalog.final_questions) * 0.8)::integer
    )::text, 'sha256');
    insert into public.fundamentals_final_sessions (
      user_id, session_id, unit_id, content_version, catalog_hash, start_hash, question_order,
      responses, position, state, score, required_score, passed, started_at, submitted_at,
      submitted_received_at, submission_hash, revision
    ) values (
      v_user_id, v_session_id, v_unit_id, v_content_version, v_catalog.content_hash, v_start_hash,
      v_catalog.final_questions, v_responses, jsonb_array_length(v_catalog.final_questions) - 1,
      'submitted', v_score, ceil(jsonb_array_length(v_catalog.final_questions) * 0.8)::integer,
      v_score >= ceil(jsonb_array_length(v_catalog.final_questions) * 0.8)::integer,
      v_started_at, v_submitted_at, clock_timestamp(), v_submission_hash, 1
    ) on conflict (user_id, session_id) do nothing;
    select * into v_session from public.fundamentals_final_sessions
      where user_id = v_user_id and session_id = v_session_id for update;
    if v_session.state <> 'submitted' or v_session.submission_hash is distinct from v_submission_hash then
      raise exception 'submitted final session UUID collision' using errcode = '23505';
    end if;
    if v_score >= ceil(jsonb_array_length(v_catalog.final_questions) * 0.8)::integer then
      v_imported_passed_session := v_session_id;
      v_imported_passed_at := v_submitted_at;
    end if;
    for v_position in 0..jsonb_array_length(v_catalog.final_questions) - 1 loop
      v_question := v_catalog.final_questions->v_position;
      v_response := v_responses->v_position::text;
      v_selected := v_response->'selected';
      v_correct := public.fundamentals_canonical_selection(v_question, v_question->'correctChoiceIds');
      v_event_id := (v_event_ids->>v_position)::uuid;
      v_duration := (v_response->>'durationMs')::integer;
      v_event_hash := extensions.digest(jsonb_build_object(
        'kind', 'lesson-final', 'sessionId', v_session_id, 'position', v_position,
        'selected', v_selected, 'durationMs', v_duration,
        'answeredAt', (v_response->>'selectedAt')::timestamptz
      )::text, 'sha256');
      select count(*)::integer + 1,
        count(*) filter (where not is_correct)::integer
        into v_attempt_number, v_prior_incorrect_count
        from public.learning_events
        where user_id = v_user_id and question_id = v_question->>'questionId'
          and question_revision = (v_question->>'revision')::integer;
      v_context := jsonb_build_object(
        'kind', 'lesson-final', 'unitId', v_unit_id, 'contentVersion', v_content_version,
        'catalogHash', encode(v_catalog.content_hash, 'hex'), 'sessionId', v_session_id,
        'position', v_position, 'questionRef', v_response->'questionRef'
      );
      insert into public.learning_events (
        user_id, event_id, payload_hash, schema_version, certification_id, question_id,
        question_revision, source_version, category, mode, answered_at, selected, correct,
        is_correct, duration_ms, attempt_number, prior_incorrect_count, review_correct, reward,
        fundamentals_session_id, learning_context, selection_polarity, required_choices
      ) values (
        v_user_id, v_event_id, v_event_hash, 1, 'fundamentals', v_question->>'questionId',
        (v_question->>'revision')::integer, v_question->>'sourceVersion', v_question->>'category',
        'study', (v_response->>'selectedAt')::timestamptz, v_selected, v_correct, v_selected = v_correct, v_duration,
        v_attempt_number, v_prior_incorrect_count, null, case when v_selected = v_correct then 1 else 0 end,
        v_session_id, v_context, v_question->>'selectionPolarity', (v_question->>'requiredChoices')::smallint
      ) on conflict (user_id, event_id) do nothing;
      if (select payload_hash from public.learning_events where user_id = v_user_id and event_id = v_event_id)
        is distinct from v_event_hash then
        raise exception 'submitted final event UUID collision' using errcode = '23505';
      end if;
    end loop;
  end loop;

  update public.fundamentals_unit_progress set
    completed_slide_ids = v_slides,
    completed_checkpoint_ids = v_checkpoints,
    furthest_plan_position = greatest(
      furthest_plan_position,
      (p_payload->>'furthestPlanPosition')::integer
    ),
    resume_stage = case
      when v_progress.active_final_session_id is not null then 'final'
      when jsonb_array_length(p_payload->'submittedFinals') > 0
        and v_progress.furthest_plan_position = 0
        and v_progress.resume_stage = 'slide'
        and v_progress.passed_final_session_id is null then 'result'
      else v_progress.resume_stage
    end,
    resume_step_id = case
      when v_progress.active_final_session_id is not null
        or v_progress.resume_stage = 'result'
        or (jsonb_array_length(p_payload->'submittedFinals') > 0
          and v_progress.furthest_plan_position = 0
          and v_progress.resume_stage = 'slide'
          and v_progress.passed_final_session_id is null) then null
      else v_progress.resume_step_id
    end,
    active_final_session_id = v_progress.active_final_session_id,
    passed_final_session_id = coalesce(passed_final_session_id, v_imported_passed_session),
    passed_at = coalesce(passed_at, v_imported_passed_at),
    revision = revision + 1,
    last_mutation_id = null,
    last_mutation_hash = null,
    updated_at = clock_timestamp()
    where user_id = v_user_id and unit_id = v_unit_id and content_version = v_content_version;

  insert into public.migration_items (
    user_id, manifest_id, source_row_id, import_kind, payload_hash, outcome
  ) values (
    v_user_id, p_manifest_id, p_source_row_id, 'fundamentals-unit', v_payload_hash, 'accepted'
  );
  return public.fundamentals_progress_snapshot(v_user_id, v_unit_id, v_content_version);
end $$;

revoke all on function public.fundamentals_import_question_matches(jsonb, jsonb),
  public.fundamentals_import_response(jsonb, jsonb),
  public.import_fundamentals_unit(bigint, uuid, text, jsonb) from public, anon;
grant execute on function public.import_fundamentals_unit(bigint, uuid, text, jsonb) to authenticated;
