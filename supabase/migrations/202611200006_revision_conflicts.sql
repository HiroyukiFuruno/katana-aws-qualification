-- PostgREST 14 は custom SQLSTATE 40001 を無限再試行する。ここで扱うのは PostgreSQL の
-- serialization failure ではなく業務上の revision 競合なので、HTTP 412 として返す。
-- 現行有効な 002 定義を明示コピーし、変更は対象四箇所の errcode だけに限定する。

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
  if v_session.revision is distinct from p_expected_revision then raise exception 'stale exam draft' using errcode = 'PT412'; end if;
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
    raise exception 'stale exam draft' using errcode = 'PT412';
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

create or replace function public.replace_roadmap_profile(
  p_earned jsonb, p_answers jsonb, p_expected_generation bigint, p_expected_revision bigint
) returns bigint language plpgsql security definer set search_path = public, auth as $$
declare v_user_id uuid := public.require_learning_generation(p_expected_generation); v_revision bigint;
begin
  insert into public.roadmap_profiles(user_id) values (v_user_id) on conflict do nothing;
  select revision into v_revision from public.roadmap_profiles where user_id = v_user_id for update;
  if v_revision is distinct from p_expected_revision then
    raise exception 'stale roadmap profile' using errcode = 'PT412';
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
    raise exception 'stale roadmap profile' using errcode = 'PT412';
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

revoke all on function public.save_exam_response(uuid, bigint, bigint, integer, jsonb, jsonb, boolean, integer, timestamptz),
  public.finalize_exam_session(uuid, bigint, bigint, jsonb),
  public.replace_roadmap_profile(jsonb, jsonb, bigint, bigint),
  public.import_roadmap_profile(bigint, uuid, text, bigint, jsonb, jsonb) from public, anon;
grant execute on function public.save_exam_response(uuid, bigint, bigint, integer, jsonb, jsonb, boolean, integer, timestamptz),
  public.finalize_exam_session(uuid, bigint, bigint, jsonb),
  public.replace_roadmap_profile(jsonb, jsonb, bigint, bigint),
  public.import_roadmap_profile(bigint, uuid, text, bigint, jsonb, jsonb) to authenticated;
