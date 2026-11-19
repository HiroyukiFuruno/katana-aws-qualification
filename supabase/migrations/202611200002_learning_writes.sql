-- 所有者はセッションから取得し、再試行・競合をDBトランザクション内で判定する。
create or replace function public.require_learning_user() returns uuid
language plpgsql stable security definer set search_path = public, auth as $$
declare v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '42501'; end if;
  return v_user_id;
end $$;

create or replace function public.initialize_learning_state() returns bigint
language plpgsql security definer set search_path = public, auth as $$
declare v_user_id uuid := public.require_learning_user(); v_generation bigint;
begin
  insert into public.learning_state (user_id) values (v_user_id) on conflict (user_id) do nothing;
  select generation into v_generation from public.learning_state where user_id = v_user_id;
  return v_generation;
end $$;

create or replace function public.require_learning_generation(p_expected_generation bigint) returns uuid
language plpgsql security definer set search_path = public, auth as $$
declare v_user_id uuid := public.require_learning_user(); v_generation bigint;
begin
  if p_expected_generation is null or p_expected_generation < 0 then
    raise exception 'invalid learning generation' using errcode = '22023';
  end if;
  select generation into v_generation from public.learning_state where user_id = v_user_id for share;
  if not found then raise exception 'learning state is not initialized' using errcode = '22023'; end if;
  if v_generation <> p_expected_generation then raise exception 'stale learning state' using errcode = 'PT409'; end if;
  return v_user_id;
end $$;

create or replace function public.append_learning_event(
  p_event jsonb, p_expected_generation bigint, p_manifest_id uuid default null, p_source_row_id text default null
) returns uuid
language plpgsql security definer set search_path = public, auth, extensions as $$
declare
  v_user_id uuid := public.require_learning_generation(p_expected_generation);
  v_event_id uuid := (p_event->>'event_id')::uuid;
  v_hash bytea := extensions.digest(p_event::text, 'sha256');
  v_existing bytea;
  v_manifest_event_id uuid;
  v_manifest_outcome text;
  v_manifest_status text;
  v_exam_state text;
  v_question_order jsonb;
begin
  if jsonb_typeof(p_event) <> 'object' or v_event_id is null then
    raise exception 'invalid learning event' using errcode = '22023';
  end if;
  if p_manifest_id is not null then
    select status into v_manifest_status from public.migration_manifests
      where user_id = v_user_id and manifest_id = p_manifest_id for update;
    if v_manifest_status is distinct from 'started' or p_source_row_id is null then
      raise exception 'invalid migration manifest item' using errcode = '22023';
    end if;
  end if;
  if p_event->>'mode' = 'exam' then
    select state, question_order into v_exam_state, v_question_order from public.exam_sessions
      where user_id = v_user_id and exam_id = (p_event->>'exam_id')::uuid;
    if v_exam_state is distinct from 'submitted' or not (v_question_order @> jsonb_build_array(jsonb_build_object(
      'question_id', p_event->>'question_id', 'question_revision', (p_event->>'question_revision')::integer
    ))) then
      raise exception 'exam event is not from a completed fixed session' using errcode = '22023';
    end if;
  end if;
  insert into public.learning_events (
    user_id, event_id, payload_hash, schema_version, certification_id, question_id,
    question_revision, source_version, category, mode, exam_id, answered_at, selected,
    correct, answer_format, is_correct, duration_ms, attempt_number, prior_incorrect_count,
    review_correct, reward
  ) values (
    v_user_id, v_event_id, v_hash, (p_event->>'schema_version')::integer,
    p_event->>'certification_id', p_event->>'question_id', (p_event->>'question_revision')::integer,
    p_event->>'source_version', p_event->>'category', p_event->>'mode',
    nullif(p_event->>'exam_id', '')::uuid, (p_event->>'answered_at')::timestamptz,
    p_event->'selected', p_event->'correct', p_event->>'answer_format',
    (p_event->>'is_correct')::boolean, (p_event->>'duration_ms')::integer,
    (p_event->>'attempt_number')::integer, (p_event->>'prior_incorrect_count')::integer,
    case when p_event ? 'review_correct' then (p_event->>'review_correct')::boolean end,
    (p_event->>'reward')::smallint
  ) on conflict (user_id, event_id) do nothing;

  select payload_hash into v_existing from public.learning_events
    where user_id = v_user_id and event_id = v_event_id;
  if v_existing is distinct from v_hash then
    raise exception 'event id reused with different payload' using errcode = '23505';
  end if;

  if p_manifest_id is not null then
    insert into public.migration_items (user_id, manifest_id, source_row_id, event_id, outcome)
      values (v_user_id, p_manifest_id, p_source_row_id, v_event_id, 'accepted')
      on conflict (user_id, manifest_id, source_row_id) do nothing;
    select event_id, outcome into v_manifest_event_id, v_manifest_outcome
      from public.migration_items
      where user_id = v_user_id and manifest_id = p_manifest_id and source_row_id = p_source_row_id;
    if v_manifest_outcome is distinct from 'accepted' or v_manifest_event_id is distinct from v_event_id then
      raise exception 'migration row reused with a different outcome or event' using errcode = '23505';
    end if;
  end if;
  return v_event_id;
end $$;

create or replace function public.start_exam_session(
  p_exam_id uuid, p_certification_id text, p_source_version text,
  p_question_order jsonb, p_duration_ms integer, p_expected_generation bigint
) returns table (exam_id uuid, deadline_at timestamptz, revision bigint)
language plpgsql security definer set search_path = public, auth, extensions as $$
declare
  v_user_id uuid := public.require_learning_generation(p_expected_generation);
  v_hash bytea := extensions.digest(jsonb_build_object(
    'certification_id', p_certification_id, 'source_version', p_source_version,
    'question_order', p_question_order, 'duration_ms', p_duration_ms
  )::text, 'sha256');
begin
  if p_exam_id is null or jsonb_typeof(p_question_order) <> 'array' or jsonb_array_length(p_question_order) = 0
    or p_duration_ms not between 60000 and 21600000 then
    raise exception 'invalid exam start' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_question_order) as q(value)
    where jsonb_typeof(q.value) <> 'object'
      or nullif(q.value->>'question_id', '') is null
      or coalesce((q.value->>'question_revision')::integer, 0) < 1
  ) or exists (
    select 1 from jsonb_array_elements(p_question_order) as q(value)
    group by q.value->>'question_id', (q.value->>'question_revision')::integer having count(*) > 1
  ) then
    raise exception 'exam order must contain distinct question snapshots' using errcode = '22023';
  end if;
  insert into public.exam_sessions (
    user_id, exam_id, start_hash, certification_id, source_version, question_order, deadline_at
  ) values (
    v_user_id, p_exam_id, v_hash, p_certification_id, p_source_version, p_question_order,
    clock_timestamp() + make_interval(secs => p_duration_ms / 1000.0)
  ) on conflict on constraint exam_sessions_pkey do nothing;
  return query select s.exam_id, s.deadline_at, s.revision from public.exam_sessions s
    where s.user_id = v_user_id and s.exam_id = p_exam_id and s.start_hash = v_hash;
  if not found then raise exception 'exam id collision' using errcode = '23505'; end if;
end $$;

create or replace function public.save_exam_response(
  p_exam_id uuid, p_expected_generation bigint, p_expected_revision bigint, p_position integer, p_question_ref jsonb,
  p_selected jsonb, p_flagged boolean, p_duration_ms integer, p_selected_at timestamptz
) returns bigint
language plpgsql security definer set search_path = public, auth as $$
declare v_user_id uuid := public.require_learning_generation(p_expected_generation); v_session public.exam_sessions%rowtype; v_revision bigint;
begin
  select * into v_session from public.exam_sessions
    where user_id = v_user_id and exam_id = p_exam_id and state = 'draft' for update;
  if not found then raise exception 'exam is not an active draft' using errcode = '22023'; end if;
  if clock_timestamp() > v_session.deadline_at then
    raise exception 'exam deadline passed' using errcode = '22023';
  end if;
  if v_session.revision is distinct from p_expected_revision then raise exception 'stale exam draft' using errcode = '40001'; end if;
  if jsonb_typeof(p_selected) <> 'array' or jsonb_typeof(p_question_ref) <> 'object'
    or p_position not between 0 and jsonb_array_length(v_session.question_order) - 1
    or v_session.question_order -> p_position <> p_question_ref
    or p_duration_ms not between 0 and 86400000 then
    raise exception 'invalid exam response' using errcode = '22023';
  end if;
  if (p_selected_at is null and (p_selected is distinct from '[]'::jsonb or p_duration_ms is distinct from 0))
    or p_selected_at > least(clock_timestamp(), v_session.deadline_at)
    or (v_session.started_at is not null and p_selected_at < v_session.started_at) then
    raise exception 'invalid exam response timing' using errcode = '22023';
  end if;
  insert into public.exam_responses (user_id, exam_id, question_key, selected, flagged, duration_ms, selected_at)
    values (v_user_id, p_exam_id, p_question_ref::text, p_selected, p_flagged, p_duration_ms, p_selected_at)
    on conflict (user_id, exam_id, question_key) do update set selected = excluded.selected,
      flagged = excluded.flagged, duration_ms = excluded.duration_ms, selected_at = excluded.selected_at,
      updated_at = clock_timestamp();
  update public.exam_sessions set position = p_position, revision = revision + 1
    where user_id = v_user_id and exam_id = p_exam_id returning revision into v_revision;
  return v_revision;
end $$;

create or replace function public.finalize_exam_session(
  p_exam_id uuid, p_expected_generation bigint, p_expected_revision bigint, p_events jsonb
)
returns timestamptz language plpgsql security definer set search_path = public, auth, extensions as $$
declare
  v_user_id uuid := public.require_learning_generation(p_expected_generation); v_session public.exam_sessions%rowtype;
  v_event jsonb; v_position bigint; v_received_at timestamptz := clock_timestamp(); v_submitted_at timestamptz;
  v_submission_hash bytea := extensions.digest(p_events::text, 'sha256');
begin
  select * into v_session from public.exam_sessions
    where user_id = v_user_id and exam_id = p_exam_id for update;
  if not found then raise exception 'exam not found' using errcode = '22023'; end if;
  if v_session.state = 'submitted' then
    if v_session.submission_hash is distinct from v_submission_hash then
      raise exception 'exam submission changed' using errcode = '23505';
    end if;
    return v_session.submitted_at;
  end if;
  if v_session.revision is distinct from p_expected_revision then
    raise exception 'stale exam draft' using errcode = '40001';
  end if;
  if jsonb_typeof(p_events) <> 'array' or jsonb_array_length(p_events) <> jsonb_array_length(v_session.question_order)
    or exists (
      select 1 from jsonb_array_elements(p_events) with ordinality as e(value, position)
      where e.value->>'question_id' is distinct from
          v_session.question_order -> ((e.position - 1)::integer) ->> 'question_id'
        or (e.value->>'question_revision')::integer is distinct from
          (v_session.question_order -> ((e.position - 1)::integer) ->> 'question_revision')::integer
    ) then
    raise exception 'exam submission does not match question order' using errcode = '22023';
  end if;
  if v_session.deadline_at is null then
    raise exception 'exam deadline is unavailable' using errcode = '22023';
  end if;
  v_submitted_at := least(v_received_at, v_session.deadline_at);
  if exists (
    select 1 from jsonb_array_elements(p_events) with ordinality as event(value, position)
    left join public.exam_responses response on response.user_id = v_user_id and response.exam_id = p_exam_id
      and response.question_key = (v_session.question_order -> ((event.position - 1)::integer))::text
    where (response.question_key is null and (
      event.value->'selected' is distinct from '[]'::jsonb
      or (event.value->>'duration_ms')::integer is distinct from 0
      or (event.value->>'flagged')::boolean is distinct from false
      or event.value->>'selected_at' is not null
      or (event.value->>'is_correct')::boolean is distinct from false
      or (event.value->>'reward')::smallint is distinct from 0
    )) or (response.question_key is not null and response.selected_at is null and (
      response.selected is distinct from '[]'::jsonb
      or response.duration_ms is distinct from 0
      or response.selected is distinct from event.value->'selected'
      or response.duration_ms is distinct from (event.value->>'duration_ms')::integer
      or response.flagged is distinct from (event.value->>'flagged')::boolean
      or event.value->>'selected_at' is not null
      or response.updated_at > v_session.deadline_at
      or (event.value->>'is_correct')::boolean is distinct from false
      or (event.value->>'reward')::smallint is distinct from 0
    )) or (response.question_key is not null and response.selected_at is not null and (
      response.selected is distinct from event.value->'selected'
      or response.duration_ms is distinct from (event.value->>'duration_ms')::integer
      or response.selected_at is distinct from (event.value->>'selected_at')::timestamptz
      or (event.value->>'answered_at')::timestamptz is distinct from response.selected_at
      or response.selected_at > v_session.deadline_at or response.updated_at > v_session.deadline_at
      or response.flagged is distinct from (event.value->>'flagged')::boolean
    ))
  ) then
    raise exception 'exam submission differs from saved responses' using errcode = '22023';
  end if;
  update public.exam_sessions set state = 'submitted', submitted_at = v_submitted_at,
    submitted_received_at = v_received_at, submission_hash = v_submission_hash,
    revision = revision + 1 where user_id = v_user_id and exam_id = p_exam_id;
  for v_event, v_position in select event.value, event.position
    from jsonb_array_elements(p_events) with ordinality as event(value, position) loop
    if not exists (
      select 1 from public.exam_responses response
      where response.user_id = v_user_id and response.exam_id = p_exam_id
        and response.question_key = (v_session.question_order -> ((v_position - 1)::integer))::text
        and response.selected_at is not null
    ) then
      v_event := jsonb_set(v_event, '{answered_at}', to_jsonb(v_submitted_at));
    end if;
    if (v_event->>'exam_id')::uuid is distinct from p_exam_id
      or v_event->>'certification_id' is distinct from v_session.certification_id
      or v_event->>'mode' is distinct from 'exam'
      or (v_event->>'answered_at')::timestamptz < v_session.started_at
      or (v_event->>'answered_at')::timestamptz > v_session.deadline_at then
      raise exception 'invalid exam event' using errcode = '22023';
    end if;
    perform public.append_learning_event(v_event, p_expected_generation);
  end loop;
  return v_submitted_at;
end $$;

create or replace function public.import_exam_session(
  p_expected_generation bigint, p_manifest_id uuid, p_source_row_id text, p_exam jsonb,
  p_draft_responses jsonb, p_events jsonb
) returns uuid language plpgsql security definer set search_path = public, auth, extensions as $$
declare
  v_user_id uuid := public.require_learning_generation(p_expected_generation);
  v_manifest_status text; v_exam_id uuid := (p_exam->>'exam_id')::uuid; v_state text := p_exam->>'state';
  v_started_at timestamptz := (p_exam->>'started_at')::timestamptz;
  v_deadline_at timestamptz := (p_exam->>'deadline_at')::timestamptz;
  v_legacy boolean := coalesce((p_exam->>'legacy_import')::boolean, false);
  v_submitted_at timestamptz := nullif(p_exam->>'submitted_at', '')::timestamptz;
  v_question_order jsonb := p_exam->'question_order'; v_response jsonb; v_event jsonb; v_hash bytea;
  v_recorded_exam_id uuid; v_recorded_payload_hash bytea; v_recorded_outcome text;
begin
  if nullif(p_source_row_id, '') is null or length(p_source_row_id) > 200
    or jsonb_typeof(p_exam) <> 'object' or jsonb_typeof(v_question_order) <> 'array'
    or jsonb_array_length(v_question_order) = 0 or jsonb_typeof(p_draft_responses) <> 'array'
    or jsonb_typeof(p_events) <> 'array' or v_exam_id is null
    or v_state not in ('draft', 'submitted') or (not v_legacy and (v_started_at is null or v_deadline_at <= v_started_at))
    or coalesce((p_exam->>'position')::integer, -1) not between 0 and jsonb_array_length(v_question_order) - 1
    or nullif(p_exam->>'certification_id', '') is null or nullif(p_exam->>'source_version', '') is null then
    raise exception 'invalid imported exam session' using errcode = '22023';
  end if;
  select status into v_manifest_status from public.migration_manifests
    where user_id = v_user_id and manifest_id = p_manifest_id for update;
  if v_manifest_status is distinct from 'started' then raise exception 'invalid migration manifest item' using errcode = '22023'; end if;
  if exists (
    select 1 from jsonb_array_elements(v_question_order) as question(value)
    where jsonb_typeof(question.value) <> 'object' or nullif(question.value->>'question_id', '') is null
      or coalesce((question.value->>'question_revision')::integer, 0) < 1
      or question.value - 'question_id' - 'question_revision' <> '{}'::jsonb
  ) or exists (
    select 1 from jsonb_array_elements(v_question_order) as question(value)
    group by question.value->>'question_id', (question.value->>'question_revision')::integer having count(*) > 1
  ) then raise exception 'invalid imported exam order' using errcode = '22023'; end if;
  if (v_state = 'draft' and (v_deadline_at is null or v_deadline_at <= clock_timestamp() or jsonb_array_length(p_events) <> 0 or v_submitted_at is not null))
    or (v_state = 'submitted' and ((not v_legacy and (v_submitted_at is null or v_submitted_at < v_started_at or v_submitted_at > v_deadline_at))
      or jsonb_array_length(p_events) <> jsonb_array_length(v_question_order))) then
    raise exception 'imported exam state cannot be resumed' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_events) with ordinality as event(value, position)
    where event.value->>'question_id' is distinct from v_question_order -> ((event.position - 1)::integer) ->> 'question_id'
      or (event.value->>'question_revision')::integer is distinct from
        (v_question_order -> ((event.position - 1)::integer) ->> 'question_revision')::integer
      or event.value->>'mode' is distinct from 'exam' or (event.value->>'exam_id')::uuid is distinct from v_exam_id
      or event.value->>'certification_id' is distinct from p_exam->>'certification_id'
      or (v_started_at is not null and (event.value->>'answered_at')::timestamptz < v_started_at)
      or (v_deadline_at is not null and (event.value->>'answered_at')::timestamptz > v_deadline_at)
  ) then raise exception 'invalid imported exam events' using errcode = '22023'; end if;
  v_hash := extensions.digest(jsonb_build_object('exam', p_exam, 'responses', p_draft_responses, 'events', p_events)::text, 'sha256');
  insert into public.exam_sessions (
    user_id, exam_id, start_hash, certification_id, source_version, question_order, legacy_import, started_at, deadline_at,
    position, state, submitted_at, submitted_received_at, submission_hash
  ) values (
    v_user_id, v_exam_id, v_hash, p_exam->>'certification_id', p_exam->>'source_version', v_question_order, v_legacy,
    v_started_at, v_deadline_at, (p_exam->>'position')::integer, v_state, v_submitted_at,
    case when v_state = 'submitted' and not v_legacy then clock_timestamp() end,
    case when v_state = 'submitted' then extensions.digest(p_events::text, 'sha256') end
  ) on conflict on constraint exam_sessions_pkey do nothing;
  if not exists (select 1 from public.exam_sessions where user_id = v_user_id and exam_id = v_exam_id and start_hash = v_hash) then
    raise exception 'imported exam id collision' using errcode = '23505';
  end if;
  for v_response in select value from jsonb_array_elements(p_draft_responses) loop
    if v_state <> 'draft' or jsonb_typeof(v_response) <> 'object' or jsonb_typeof(v_response->'question_ref') <> 'object'
      or jsonb_typeof(v_response->'selected') <> 'array' or not exists (
        select 1 from jsonb_array_elements(v_question_order) as question(value)
        where question.value = v_response->'question_ref'
      )
      or coalesce((v_response->>'duration_ms')::integer, -1) not between 0 and 86400000 then
      raise exception 'invalid imported exam response' using errcode = '22023';
    end if;
    if (nullif(v_response->>'selected_at', '') is null
      and (v_response->'selected' is distinct from '[]'::jsonb or (v_response->>'duration_ms')::integer is distinct from 0))
      or nullif(v_response->>'selected_at', '')::timestamptz > least(clock_timestamp(), v_deadline_at)
      or (v_started_at is not null and nullif(v_response->>'selected_at', '')::timestamptz < v_started_at) then
      raise exception 'invalid imported exam response timing' using errcode = '22023';
    end if;
    insert into public.exam_responses (user_id, exam_id, question_key, selected, flagged, duration_ms, selected_at)
      values (v_user_id, v_exam_id, (v_response->'question_ref')::text, v_response->'selected',
        coalesce((v_response->>'flagged')::boolean, false), (v_response->>'duration_ms')::integer,
        nullif(v_response->>'selected_at', '')::timestamptz) on conflict do nothing;
  end loop;
  for v_event in select value from jsonb_array_elements(p_events) loop
    perform public.append_learning_event(v_event, p_expected_generation);
  end loop;
  insert into public.migration_items (user_id, manifest_id, source_row_id, exam_id, import_kind, payload_hash, outcome)
    values (v_user_id, p_manifest_id, p_source_row_id, v_exam_id, 'exam-session', v_hash, 'accepted')
    on conflict (user_id, manifest_id, source_row_id) do nothing;
  select exam_id, payload_hash, outcome into v_recorded_exam_id, v_recorded_payload_hash, v_recorded_outcome
    from public.migration_items
    where user_id = v_user_id and manifest_id = p_manifest_id and source_row_id = p_source_row_id;
  if v_recorded_outcome is distinct from 'accepted' or v_recorded_exam_id is distinct from v_exam_id
    or v_recorded_payload_hash is distinct from v_hash then
    raise exception 'migration row reused with a different exam or payload' using errcode = '23505';
  end if;
  return v_exam_id;
end $$;

create or replace function public.accept_migration_row(
  p_expected_generation bigint, p_manifest_id uuid, p_source_row_id text
) returns void language plpgsql security definer set search_path = public, auth as $$
declare v_user_id uuid := public.require_learning_generation(p_expected_generation); v_manifest_status text;
begin
  if nullif(p_source_row_id, '') is null or length(p_source_row_id) > 200 then
    raise exception 'invalid migration row' using errcode = '22023';
  end if;
  select status into v_manifest_status from public.migration_manifests
    where user_id = v_user_id and manifest_id = p_manifest_id for update;
  if v_manifest_status is distinct from 'started' then raise exception 'invalid migration manifest item' using errcode = '22023'; end if;
  insert into public.migration_items (user_id, manifest_id, source_row_id, outcome)
    values (v_user_id, p_manifest_id, p_source_row_id, 'accepted')
    on conflict (user_id, manifest_id, source_row_id) do nothing;
  if exists (
    select 1 from public.migration_items
    where user_id = v_user_id and manifest_id = p_manifest_id and source_row_id = p_source_row_id
      and (outcome <> 'accepted' or event_id is not null or exam_id is not null or import_kind is not null or payload_hash is not null)
  ) then
    raise exception 'migration row reused with a different outcome' using errcode = '23505';
  end if;
end $$;

create or replace function public.begin_migration(
  p_expected_generation bigint, p_manifest_id uuid, p_source_name text, p_schema_version integer, p_fingerprint text, p_declared_rows integer
) returns uuid language plpgsql security definer set search_path = public, auth as $$
declare v_user_id uuid := public.require_learning_generation(p_expected_generation); v_id uuid;
begin
  insert into public.migration_manifests (
    user_id, manifest_id, source_name, source_schema_version, source_fingerprint, declared_rows
  ) values (v_user_id, p_manifest_id, p_source_name, p_schema_version, p_fingerprint, p_declared_rows)
  on conflict (user_id, source_name, source_fingerprint) do update set manifest_id = public.migration_manifests.manifest_id
    where public.migration_manifests.source_schema_version = excluded.source_schema_version
      and public.migration_manifests.declared_rows = excluded.declared_rows
  returning manifest_id into v_id;
  if v_id is null then
    raise exception 'migration manifest reused with different shape' using errcode = '23505';
  end if;
  return v_id;
end $$;

create or replace function public.reject_migration_row(p_expected_generation bigint, p_manifest_id uuid, p_source_row_id text, p_reason_code text)
returns void language plpgsql security definer set search_path = public, auth as $$
declare v_user_id uuid := public.require_learning_generation(p_expected_generation); v_manifest_status text;
begin
  if nullif(p_source_row_id, '') is null or length(p_source_row_id) > 200
    or nullif(p_reason_code, '') is null or length(p_reason_code) > 120 then
    raise exception 'invalid migration row rejection' using errcode = '22023';
  end if;
  select status into v_manifest_status from public.migration_manifests
    where user_id = v_user_id and manifest_id = p_manifest_id for update;
  if v_manifest_status is distinct from 'started' then raise exception 'invalid migration manifest item' using errcode = '22023'; end if;
  insert into public.migration_items (user_id, manifest_id, source_row_id, outcome, reason_code)
    values (v_user_id, p_manifest_id, p_source_row_id, 'rejected', p_reason_code)
    on conflict (user_id, manifest_id, source_row_id) do nothing;
  if exists (
    select 1 from public.migration_items
    where user_id = v_user_id and manifest_id = p_manifest_id and source_row_id = p_source_row_id
      and (outcome <> 'rejected' or reason_code is distinct from p_reason_code)
  ) then
    raise exception 'migration row reused with a different outcome or reason' using errcode = '23505';
  end if;
end $$;

create or replace function public.complete_migration(p_expected_generation bigint, p_manifest_id uuid)
returns void language plpgsql security definer set search_path = public, auth as $$
declare v_user_id uuid := public.require_learning_generation(p_expected_generation); v_declared integer; v_imported integer; v_status text;
begin
  select declared_rows, status into v_declared, v_status from public.migration_manifests
    where user_id = v_user_id and manifest_id = p_manifest_id for update;
  if v_status = 'completed' then return; end if;
  if v_status is distinct from 'started' then raise exception 'invalid migration manifest' using errcode = '22023'; end if;
  select count(*) into v_imported from public.migration_items
    where user_id = v_user_id and manifest_id = p_manifest_id;
  if v_declared is null or v_imported <> v_declared then
    raise exception 'migration count mismatch' using errcode = '22023';
  end if;
  update public.migration_manifests set status = 'completed', completed_at = clock_timestamp()
    where user_id = v_user_id and manifest_id = p_manifest_id;
end $$;

create or replace function public.reset_my_learning_data(p_expected_generation bigint) returns bigint
language plpgsql security definer set search_path = public, auth as $$
declare v_user_id uuid := public.require_learning_user(); v_generation bigint;
begin
  if p_expected_generation is null or p_expected_generation < 0 then
    raise exception 'invalid learning generation' using errcode = '22023';
  end if;
  select generation into v_generation from public.learning_state where user_id = v_user_id for update;
  if not found then raise exception 'learning state is not initialized' using errcode = '22023'; end if;
  if v_generation <> p_expected_generation then raise exception 'stale learning state' using errcode = 'PT409'; end if;
  delete from public.learning_events where user_id = v_user_id;
  delete from public.exam_sessions where user_id = v_user_id;
  delete from public.earned_certifications where user_id = v_user_id;
  delete from public.assessment_answers where user_id = v_user_id;
  delete from public.migration_manifests where user_id = v_user_id;
  delete from public.roadmap_profiles where user_id = v_user_id;
  update public.learning_state set generation = generation + 1 where user_id = v_user_id returning generation into v_generation;
  return v_generation;
end $$;

create or replace function public.replace_roadmap_profile(
  p_earned jsonb, p_answers jsonb, p_expected_generation bigint, p_expected_revision bigint
) returns bigint language plpgsql security definer set search_path = public, auth as $$
declare v_user_id uuid := public.require_learning_generation(p_expected_generation); v_revision bigint;
begin
  insert into public.roadmap_profiles(user_id) values (v_user_id) on conflict do nothing;
  select revision into v_revision from public.roadmap_profiles where user_id = v_user_id for update;
  if v_revision is distinct from p_expected_revision then
    raise exception 'stale roadmap profile' using errcode = '40001';
  end if;
  if p_earned is null or p_answers is null or jsonb_typeof(p_earned) <> 'array' or jsonb_typeof(p_answers) <> 'object'
    or exists (
      select 1 from jsonb_array_elements_text(p_earned) as earned(certification_id)
      where length(earned.certification_id) not between 1 and 80
    ) or (select count(*) from jsonb_array_elements_text(p_earned)) <>
      (select count(distinct value) from jsonb_array_elements_text(p_earned))
    or exists (
      select 1 from jsonb_each(p_answers) as answer(assessment_id, value)
      where length(answer.assessment_id) not between 1 and 160
        or jsonb_typeof(answer.value) <> 'number'
        or (answer.value #>> '{}') !~ '^-?[0-9]+$'
    ) then
    raise exception 'invalid roadmap profile' using errcode = '22023';
  end if;
  delete from public.earned_certifications
    where user_id = v_user_id and not exists (
      select 1 from jsonb_array_elements_text(p_earned) as earned(certification_id)
      where earned.certification_id = public.earned_certifications.certification_id
    );
  insert into public.earned_certifications (user_id, certification_id)
    select v_user_id, earned.certification_id from jsonb_array_elements_text(p_earned) as earned(certification_id)
    on conflict (user_id, certification_id) do nothing;
  delete from public.assessment_answers
    where user_id = v_user_id and not exists (
      select 1 from jsonb_object_keys(p_answers) as key(assessment_id)
      where key.assessment_id = public.assessment_answers.assessment_id
    );
  insert into public.assessment_answers (user_id, assessment_id, answer)
    select v_user_id, answer.assessment_id, (answer.value #>> '{}')::integer
      from jsonb_each(p_answers) as answer(assessment_id, value)
    on conflict (user_id, assessment_id) do update set answer = excluded.answer, updated_at = clock_timestamp();
  update public.roadmap_profiles set revision = revision + 1 where user_id = v_user_id
    returning revision into v_revision;
  return v_revision;
end $$;

create or replace function public.import_roadmap_profile(
  p_expected_generation bigint, p_manifest_id uuid, p_source_row_id text, p_expected_revision bigint,
  p_earned jsonb, p_answers jsonb
) returns bigint language plpgsql security definer set search_path = public, auth, extensions as $$
declare
  v_user_id uuid := public.require_learning_generation(p_expected_generation); v_manifest_status text;
  v_revision bigint; v_hash bytea; v_outcome text; v_kind text; v_recorded_hash bytea;
begin
  if nullif(p_source_row_id, '') is null or length(p_source_row_id) > 200
    or p_earned is null or p_answers is null or jsonb_typeof(p_earned) <> 'array' or jsonb_typeof(p_answers) <> 'object'
    or exists (
      select 1 from jsonb_array_elements_text(p_earned) as earned(certification_id)
      where length(earned.certification_id) not between 1 and 80
    ) or (select count(*) from jsonb_array_elements_text(p_earned)) <>
      (select count(distinct value) from jsonb_array_elements_text(p_earned))
    or exists (
      select 1 from jsonb_each(p_answers) as answer(assessment_id, value)
      where length(answer.assessment_id) not between 1 and 160
        or jsonb_typeof(answer.value) <> 'number'
        or (answer.value #>> '{}') !~ '^-?[0-9]+$'
    ) then
    raise exception 'invalid imported roadmap profile' using errcode = '22023';
  end if;
  v_hash := extensions.digest(jsonb_build_object(
    'earned', p_earned, 'answers', p_answers
  )::text, 'sha256');
  select status into v_manifest_status from public.migration_manifests
    where user_id = v_user_id and manifest_id = p_manifest_id for update;
  if v_manifest_status is distinct from 'started' then raise exception 'invalid migration manifest item' using errcode = '22023'; end if;
  select outcome, import_kind, payload_hash into v_outcome, v_kind, v_recorded_hash from public.migration_items
    where user_id = v_user_id and manifest_id = p_manifest_id and source_row_id = p_source_row_id for update;
  if found then
    if v_outcome is distinct from 'accepted' or v_kind is distinct from 'roadmap-profile'
      or v_recorded_hash is distinct from v_hash then
      raise exception 'migration row reused with a different roadmap profile' using errcode = '23505';
    end if;
    select revision into v_revision from public.roadmap_profiles where user_id = v_user_id;
    if not found then raise exception 'imported roadmap profile is missing' using errcode = '23505'; end if;
    return v_revision;
  end if;
  insert into public.roadmap_profiles(user_id) values (v_user_id) on conflict do nothing;
  select revision into v_revision from public.roadmap_profiles where user_id = v_user_id for update;
  if v_revision is distinct from p_expected_revision then
    raise exception 'stale roadmap profile' using errcode = '40001';
  end if;
  delete from public.earned_certifications
    where user_id = v_user_id and not exists (
      select 1 from jsonb_array_elements_text(p_earned) as earned(certification_id)
      where earned.certification_id = public.earned_certifications.certification_id
    );
  insert into public.earned_certifications (user_id, certification_id)
    select v_user_id, earned.certification_id from jsonb_array_elements_text(p_earned) as earned(certification_id)
    on conflict (user_id, certification_id) do nothing;
  delete from public.assessment_answers
    where user_id = v_user_id and not exists (
      select 1 from jsonb_object_keys(p_answers) as key(assessment_id)
      where key.assessment_id = public.assessment_answers.assessment_id
    );
  insert into public.assessment_answers (user_id, assessment_id, answer)
    select v_user_id, answer.assessment_id, (answer.value #>> '{}')::integer
      from jsonb_each(p_answers) as answer(assessment_id, value)
    on conflict (user_id, assessment_id) do update set answer = excluded.answer, updated_at = clock_timestamp();
  update public.roadmap_profiles set revision = revision + 1 where user_id = v_user_id
    returning revision into v_revision;
  insert into public.migration_items (user_id, manifest_id, source_row_id, import_kind, payload_hash, outcome)
    values (v_user_id, p_manifest_id, p_source_row_id, 'roadmap-profile', v_hash, 'accepted');
  return v_revision;
end $$;

revoke all on function public.require_learning_user(), public.require_learning_generation(bigint) from public, anon;
revoke all on function public.initialize_learning_state(), public.append_learning_event(jsonb, bigint, uuid, text),
  public.start_exam_session(uuid, text, text, jsonb, integer, bigint),
  public.save_exam_response(uuid, bigint, bigint, integer, jsonb, jsonb, boolean, integer, timestamptz),
  public.finalize_exam_session(uuid, bigint, bigint, jsonb), public.begin_migration(bigint, uuid, text, integer, text, integer),
  public.import_exam_session(bigint, uuid, text, jsonb, jsonb, jsonb),
  public.accept_migration_row(bigint, uuid, text), public.reject_migration_row(bigint, uuid, text, text),
  public.complete_migration(bigint, uuid), public.reset_my_learning_data(bigint),
  public.replace_roadmap_profile(jsonb, jsonb, bigint, bigint),
  public.import_roadmap_profile(bigint, uuid, text, bigint, jsonb, jsonb) from public, anon;
grant execute on function public.initialize_learning_state(), public.append_learning_event(jsonb, bigint, uuid, text),
  public.start_exam_session(uuid, text, text, jsonb, integer, bigint),
  public.save_exam_response(uuid, bigint, bigint, integer, jsonb, jsonb, boolean, integer, timestamptz),
  public.finalize_exam_session(uuid, bigint, bigint, jsonb), public.begin_migration(bigint, uuid, text, integer, text, integer),
  public.import_exam_session(bigint, uuid, text, jsonb, jsonb, jsonb),
  public.accept_migration_row(bigint, uuid, text), public.reject_migration_row(bigint, uuid, text, text),
  public.complete_migration(bigint, uuid), public.reset_my_learning_data(bigint),
  public.replace_roadmap_profile(jsonb, jsonb, bigint, bigint),
  public.import_roadmap_profile(bigint, uuid, text, bigint, jsonb, jsonb) to authenticated;
