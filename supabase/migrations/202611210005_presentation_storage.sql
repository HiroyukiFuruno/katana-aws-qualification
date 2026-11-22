-- 表示順は採点用のquestion_order/回答から分離する。旧RPCは互換のため残し、新規clientだけv2を使う。
alter table public.roadmap_profiles
  add column presentation jsonb not null default '{}'::jsonb
  check (jsonb_typeof(presentation) = 'object');
alter table public.exam_sessions
  add column presentation jsonb not null default '{}'::jsonb
  check (jsonb_typeof(presentation) = 'object');
alter table public.migration_items
  add column presentation_hash bytea check (presentation_hash is null or octet_length(presentation_hash) = 32);

create or replace function public.valid_profile_presentation(p_presentation jsonb)
returns boolean language sql immutable set search_path = pg_catalog as $$
  select p_presentation is not null
    and jsonb_typeof(p_presentation) = 'object'
    and p_presentation - 'optionOrders' - 'order' = '{}'::jsonb
    and jsonb_typeof(p_presentation->'optionOrders') = 'object'
    and jsonb_typeof(p_presentation->'order') = 'array'
    and not exists (
      select 1 from jsonb_array_elements(p_presentation->'order') value(id)
      where jsonb_typeof(value.id) <> 'string' or length(value.id #>> '{}') not between 1 and 160
    )
    and (select count(*) from jsonb_array_elements_text(p_presentation->'order')) =
      (select count(distinct value) from jsonb_array_elements_text(p_presentation->'order'))
    and not exists (
      select 1 from jsonb_each(p_presentation->'optionOrders') entry(question_id, option_order)
      where length(entry.question_id) not between 1 and 160
        or not (p_presentation->'order' ? entry.question_id)
        or jsonb_typeof(entry.option_order) <> 'array'
        or jsonb_array_length(entry.option_order) not between 1 and 20
        or exists (
          select 1 from jsonb_array_elements(entry.option_order) option(value)
          where jsonb_typeof(option.value) <> 'number'
            or (option.value #>> '{}') !~ '^(0|[1-9]|1[0-9])$'
        )
        or (select count(*) from jsonb_array_elements(entry.option_order)) <>
          (select count(distinct value) from jsonb_array_elements(entry.option_order))
    );
$$;

create or replace function public.valid_exam_presentation(p_presentation jsonb, p_question_order jsonb)
returns boolean language sql immutable set search_path = pg_catalog as $$
  select p_presentation is not null
    and jsonb_typeof(p_presentation) = 'object'
    and p_presentation - 'choiceOrders' = '{}'::jsonb
    and jsonb_typeof(p_presentation->'choiceOrders') = 'object'
    and (select count(*) from jsonb_object_keys(p_presentation->'choiceOrders')) <= jsonb_array_length(p_question_order)
    and not exists (
      select 1 from jsonb_each(p_presentation->'choiceOrders') entry(question_key, choice_order)
      where length(entry.question_key) not between 1 and 200
        or jsonb_typeof(entry.choice_order) <> 'array'
        or jsonb_array_length(entry.choice_order) not between 1 and 20
        or not exists (
          select 1 from jsonb_array_elements(p_question_order) question(value)
          where entry.question_key =
            '[' || to_json(question.value->>'question_id')::text || ',' ||
              (question.value->'question_revision')::text || ']'
        )
        or exists (
          select 1 from jsonb_array_elements(entry.choice_order) choice(id)
          where jsonb_typeof(choice.id) <> 'string' or length(choice.id #>> '{}') not between 1 and 160
        )
        or (select count(*) from jsonb_array_elements_text(entry.choice_order)) <>
          (select count(distinct value) from jsonb_array_elements_text(entry.choice_order))
    );
$$;

create or replace function public.start_exam_session_v2(
  p_exam_id uuid, p_certification_id text, p_source_version text, p_question_order jsonb,
  p_duration_ms integer, p_expected_generation bigint, p_presentation jsonb
) returns table(exam_id uuid, deadline_at timestamptz, revision bigint)
language plpgsql security definer set search_path = public, auth as $$
declare v_user_id uuid := public.require_learning_generation(p_expected_generation); v_presentation jsonb;
begin
  if not public.valid_exam_presentation(p_presentation, p_question_order) then
    raise exception 'invalid exam presentation' using errcode = '22023';
  end if;
  perform public.start_exam_session(
    p_exam_id, p_certification_id, p_source_version, p_question_order, p_duration_ms, p_expected_generation
  );
  select session.presentation into v_presentation from public.exam_sessions session
    where session.user_id = v_user_id and session.exam_id = p_exam_id for update;
  if v_presentation = '{}'::jsonb then
    update public.exam_sessions as session set presentation = p_presentation
      where session.user_id = v_user_id and session.exam_id = p_exam_id;
  elsif v_presentation is distinct from p_presentation then
    raise exception 'exam id reused with different presentation' using errcode = '23505';
  end if;
  return query select session.exam_id, session.deadline_at, session.revision
    from public.exam_sessions session where session.user_id = v_user_id and session.exam_id = p_exam_id;
end $$;

create or replace function public.import_exam_session_v2(
  p_expected_generation bigint, p_manifest_id uuid, p_source_row_id text, p_exam jsonb,
  p_draft_responses jsonb, p_events jsonb, p_presentation jsonb
) returns uuid language plpgsql security definer set search_path = public, auth as $$
declare
  v_user_id uuid := public.require_learning_generation(p_expected_generation);
  v_exam jsonb := jsonb_set(p_exam - 'presentation', '{presentation}', p_presentation, true);
  v_exam_id uuid; v_presentation jsonb;
begin
  if jsonb_typeof(p_exam) is distinct from 'object'
    or not public.valid_exam_presentation(p_presentation, p_exam->'question_order') then
    raise exception 'invalid imported exam presentation' using errcode = '22023';
  end if;
  v_exam_id := public.import_exam_session(
    p_expected_generation, p_manifest_id, p_source_row_id, v_exam, p_draft_responses, p_events
  );
  select session.presentation into v_presentation from public.exam_sessions session
    where session.user_id = v_user_id and session.exam_id = v_exam_id for update;
  if v_presentation = '{}'::jsonb then
    update public.exam_sessions set presentation = p_presentation
      where user_id = v_user_id and exam_id = v_exam_id;
  elsif v_presentation is distinct from p_presentation then
    raise exception 'imported exam presentation changed' using errcode = '23505';
  end if;
  return v_exam_id;
end $$;

create or replace function public.load_roadmap_profile_snapshot_v2()
returns table(earned jsonb, answers jsonb, presentation jsonb, revision bigint)
language plpgsql stable security definer set search_path = public, auth as $$
declare v_user_id uuid := public.require_learning_user();
begin
  return query select
    coalesce((select jsonb_agg(e.certification_id order by e.certification_id)
      from public.earned_certifications e where e.user_id = v_user_id), '[]'::jsonb),
    coalesce((select jsonb_object_agg(a.assessment_id, a.answer order by a.assessment_id)
      from public.assessment_answers a where a.user_id = v_user_id), '{}'::jsonb),
    coalesce((select p.presentation from public.roadmap_profiles p where p.user_id = v_user_id), '{}'::jsonb),
    coalesce((select p.revision from public.roadmap_profiles p where p.user_id = v_user_id), 0);
end $$;

create or replace function public.replace_roadmap_profile_v2(
  p_earned jsonb, p_answers jsonb, p_expected_generation bigint, p_expected_revision bigint, p_presentation jsonb
) returns bigint language plpgsql security definer set search_path = public, auth as $$
declare v_user_id uuid := public.require_learning_generation(p_expected_generation); v_revision bigint;
begin
  if not public.valid_profile_presentation(p_presentation) then
    raise exception 'invalid roadmap presentation' using errcode = '22023';
  end if;
  v_revision := public.replace_roadmap_profile(p_earned, p_answers, p_expected_generation, p_expected_revision);
  update public.roadmap_profiles set presentation = p_presentation
    where user_id = v_user_id and revision = v_revision;
  return v_revision;
end $$;

create or replace function public.import_roadmap_profile_v2(
  p_expected_generation bigint, p_manifest_id uuid, p_source_row_id text, p_expected_revision bigint,
  p_earned jsonb, p_answers jsonb, p_presentation jsonb
) returns bigint language plpgsql security definer set search_path = public, auth, extensions as $$
declare
  v_user_id uuid := public.require_learning_generation(p_expected_generation); v_revision bigint;
  v_hash bytea := extensions.digest(p_presentation::text, 'sha256');
  v_existing boolean; v_stored_hash bytea;
begin
  if not public.valid_profile_presentation(p_presentation) then
    raise exception 'invalid imported roadmap presentation' using errcode = '22023';
  end if;
  select presentation_hash into v_stored_hash from public.migration_items
    where user_id = v_user_id and manifest_id = p_manifest_id and source_row_id = p_source_row_id for update;
  v_existing := found;
  v_revision := public.import_roadmap_profile(
    p_expected_generation, p_manifest_id, p_source_row_id, p_expected_revision, p_earned, p_answers
  );
  if v_existing then
    if v_stored_hash is null and p_presentation <> '{"optionOrders": {}, "order": []}'::jsonb then
      raise exception 'legacy profile import cannot gain presentation' using errcode = '23505';
    end if;
    if v_stored_hash is not null and v_stored_hash is distinct from v_hash then
      raise exception 'migration row reused with a different roadmap presentation' using errcode = '23505';
    end if;
    return v_revision;
  end if;
  update public.migration_items set presentation_hash = v_hash
    where user_id = v_user_id and manifest_id = p_manifest_id and source_row_id = p_source_row_id
      and presentation_hash is null;
  if not found then
    select presentation_hash into v_stored_hash from public.migration_items
      where user_id = v_user_id and manifest_id = p_manifest_id and source_row_id = p_source_row_id;
    if v_stored_hash is distinct from v_hash then
      raise exception 'migration row reused with a different roadmap presentation' using errcode = '23505';
    end if;
    return v_revision;
  end if;
  update public.roadmap_profiles set presentation = p_presentation
    where user_id = v_user_id;
  return v_revision;
end $$;

revoke all on function public.valid_profile_presentation(jsonb), public.valid_exam_presentation(jsonb, jsonb),
  public.start_exam_session_v2(uuid, text, text, jsonb, integer, bigint, jsonb),
  public.import_exam_session_v2(bigint, uuid, text, jsonb, jsonb, jsonb, jsonb),
  public.load_roadmap_profile_snapshot_v2(),
  public.replace_roadmap_profile_v2(jsonb, jsonb, bigint, bigint, jsonb),
  public.import_roadmap_profile_v2(bigint, uuid, text, bigint, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.start_exam_session_v2(uuid, text, text, jsonb, integer, bigint, jsonb),
  public.import_exam_session_v2(bigint, uuid, text, jsonb, jsonb, jsonb, jsonb),
  public.load_roadmap_profile_snapshot_v2(),
  public.replace_roadmap_profile_v2(jsonb, jsonb, bigint, bigint, jsonb),
  public.import_roadmap_profile_v2(bigint, uuid, text, bigint, jsonb, jsonb, jsonb) to authenticated;
