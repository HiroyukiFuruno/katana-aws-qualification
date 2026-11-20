-- #24 の会員ダッシュボードは、回答の生配列ではなく所有者固定の集計だけを返す。

create index learning_events_dashboard_review_idx
  on public.learning_events (user_id, certification_id, question_id, question_revision, source_version, answered_at desc, event_id desc)
  where mode <> 'exam';
create index exam_sessions_dashboard_submitted_idx
  on public.exam_sessions (user_id, submitted_at desc) where state = 'submitted';
create index fundamentals_final_sessions_dashboard_submitted_idx
  on public.fundamentals_final_sessions (user_id, submitted_at desc) where state = 'submitted';

create function public.dashboard_parse_timestamp(p_value jsonb, p_nullable boolean)
returns timestamptz
language plpgsql immutable security definer set search_path = public, auth as $$
declare v_timestamp timestamptz;
begin
  if p_value is null then
    raise exception 'invalid dashboard timestamp' using errcode = '22023';
  end if;
  if p_value = 'null'::jsonb and p_nullable then return null; end if;
  if jsonb_typeof(p_value) <> 'string' or nullif(p_value #>> '{}', '') is null then
    raise exception 'invalid dashboard timestamp' using errcode = '22023';
  end if;
  begin v_timestamp := (p_value #>> '{}')::timestamptz;
  exception when others then raise exception 'invalid dashboard timestamp' using errcode = '22023';
  end;
  if not isfinite(v_timestamp) then raise exception 'invalid dashboard timestamp' using errcode = '22023'; end if;
  return v_timestamp;
end $$;

create function public.dashboard_validate_text_filter(p_value jsonb, p_allowed text[], p_name text, p_limit integer)
returns void
language plpgsql immutable security definer set search_path = public, auth as $$
begin
  if p_value is null then
    raise exception 'invalid dashboard % filter', p_name using errcode = '22023';
  end if;
  if p_value = 'null'::jsonb then return; end if;
  if jsonb_typeof(p_value) <> 'array' or jsonb_array_length(p_value) = 0 or jsonb_array_length(p_value) > 200
    or exists (
      select 1 from jsonb_array_elements(p_value) item(value)
      where jsonb_typeof(item.value) <> 'string' or nullif(item.value #>> '{}', '') is null
        or length(item.value #>> '{}') > p_limit
        or (p_allowed is not null and not (item.value #>> '{}') = any(p_allowed))
    )
    or exists (
      select item.value #>> '{}' from jsonb_array_elements(p_value) item(value)
      group by item.value #>> '{}' having count(*) > 1
    ) then
    raise exception 'invalid dashboard % filter', p_name using errcode = '22023';
  end if;
end $$;

create function public.dashboard_validate_revisions(p_value jsonb)
returns void
language plpgsql immutable security definer set search_path = public, auth as $$
begin
  if p_value is null then
    raise exception 'invalid dashboard revisions filter' using errcode = '22023';
  end if;
  if p_value = 'null'::jsonb then return; end if;
  if jsonb_typeof(p_value) <> 'array' or jsonb_array_length(p_value) = 0 or jsonb_array_length(p_value) > 200
    or exists (
      select 1 from jsonb_array_elements(p_value) item(value)
      where jsonb_typeof(item.value) <> 'object'
        or (select count(*) from jsonb_object_keys(item.value)) <> 2
        or exists (select 1 from jsonb_object_keys(item.value) key where key not in ('sourceVersion', 'questionRevision'))
        or jsonb_typeof(item.value->'sourceVersion') <> 'string'
        or nullif(item.value->>'sourceVersion', '') is null or length(item.value->>'sourceVersion') > 128
        or jsonb_typeof(item.value->'questionRevision') <> 'number'
        or coalesce(item.value->>'questionRevision', '') !~ '^[1-9][0-9]*$'
    )
    or exists (
      select item.value->>'sourceVersion', item.value->>'questionRevision'
      from jsonb_array_elements(p_value) item(value)
      group by item.value->>'sourceVersion', item.value->>'questionRevision' having count(*) > 1
    ) then
    raise exception 'invalid dashboard revisions filter' using errcode = '22023';
  end if;
end $$;

create function public.dashboard_stats_json(p_answered bigint, p_correct bigint, p_duration_ms bigint)
returns jsonb
language sql immutable security definer set search_path = public, auth as $$
  select jsonb_build_object(
    'answered', p_answered, 'correct', p_correct,
    'accuracy', case when p_answered = 0 then null else p_correct::numeric / p_answered end,
    'durationMs', p_duration_ms,
    'meanDurationMs', case when p_answered = 0 then null else p_duration_ms::numeric / p_answered end
  );
$$;

create function public.dashboard_summary(p_query jsonb, p_expected_generation bigint)
returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare
  v_user_id uuid := public.require_learning_generation(p_expected_generation);
  v_from timestamptz;
  v_to timestamptz;
  v_timezone text;
  v_result jsonb;
begin
  if p_query is null or jsonb_typeof(p_query) <> 'object'
    or p_query <> jsonb_build_object(
      'range', p_query->'range', 'certificationIds', p_query->'certificationIds', 'categories', p_query->'categories',
      'modes', p_query->'modes', 'contexts', p_query->'contexts', 'formats', p_query->'formats',
      'polarities', p_query->'polarities', 'revisions', p_query->'revisions', 'unitIds', p_query->'unitIds'
    )
    or jsonb_typeof(p_query->'range') <> 'object'
    or p_query->'range' <> jsonb_build_object(
      'from', p_query->'range'->'from', 'to', p_query->'range'->'to', 'timezone', p_query->'range'->'timezone'
    ) then
    raise exception 'invalid dashboard query' using errcode = '22023';
  end if;
  v_from := public.dashboard_parse_timestamp(p_query->'range'->'from', true);
  v_to := public.dashboard_parse_timestamp(p_query->'range'->'to', false);
  v_timezone := nullif(p_query->'range'->>'timezone', '');
  if v_to <= coalesce(v_from, '-infinity'::timestamptz) or v_timezone is null
    or not exists (select 1 from pg_timezone_names where name = v_timezone) then
    raise exception 'invalid dashboard range' using errcode = '22023';
  end if;
  perform public.dashboard_validate_text_filter(p_query->'certificationIds', null, 'certificationIds', 120);
  perform public.dashboard_validate_text_filter(p_query->'categories', null, 'categories', 200);
  perform public.dashboard_validate_text_filter(p_query->'modes', array['study', 'review', 'exam'], 'modes', 20);
  perform public.dashboard_validate_text_filter(p_query->'contexts', array['practice', 'exam', 'lesson-checkpoint', 'lesson-final'], 'contexts', 40);
  perform public.dashboard_validate_text_filter(p_query->'formats', array['choice-single', 'choice-multiple', 'ordering', 'matching', 'unknown'], 'formats', 40);
  perform public.dashboard_validate_text_filter(p_query->'polarities', array['correct', 'incorrect', 'unspecified'], 'polarities', 20);
  perform public.dashboard_validate_revisions(p_query->'revisions');
  perform public.dashboard_validate_text_filter(p_query->'unitIds', null, 'unitIds', 120);

  with filters as (
    select
      case when p_query->'certificationIds' = 'null'::jsonb then null else array(select jsonb_array_elements_text(p_query->'certificationIds')) end as certification_ids,
      case when p_query->'categories' = 'null'::jsonb then null else array(select jsonb_array_elements_text(p_query->'categories')) end as categories,
      case when p_query->'modes' = 'null'::jsonb then null else array(select jsonb_array_elements_text(p_query->'modes')) end as modes,
      case when p_query->'contexts' = 'null'::jsonb then null else array(select jsonb_array_elements_text(p_query->'contexts')) end as contexts,
      case when p_query->'formats' = 'null'::jsonb then null else array(select jsonb_array_elements_text(p_query->'formats')) end as formats,
      case when p_query->'polarities' = 'null'::jsonb then null else array(select jsonb_array_elements_text(p_query->'polarities')) end as polarities,
      p_query->'revisions' as revisions,
      case when p_query->'unitIds' = 'null'::jsonb then null else array(select jsonb_array_elements_text(p_query->'unitIds')) end as unit_ids
  ), owner_events as (
    select event.*,
      case when event.mode = 'exam' then 'exam'
        when event.learning_context->>'kind' = 'lesson-final' then 'lesson-final'
        when event.learning_context->>'kind' = 'lesson-checkpoint' then 'lesson-checkpoint'
        else 'practice' end as dashboard_context,
      case when coalesce(event.answer_format, final_question.value->>'format', checkpoint_question.value->>'format') = 'ordering' then 'ordering'
        when coalesce(event.answer_format, final_question.value->>'format', checkpoint_question.value->>'format') = 'matching' then 'matching'
        when coalesce(event.answer_format, final_question.value->>'format', checkpoint_question.value->>'format') is null and coalesce(event.required_choices, jsonb_array_length(event.correct)) = 1 then 'choice-single'
        when coalesce(event.answer_format, final_question.value->>'format', checkpoint_question.value->>'format') is null and coalesce(event.required_choices, jsonb_array_length(event.correct)) > 1 then 'choice-multiple'
        else 'unknown' end as dashboard_format,
      coalesce(event.selection_polarity, 'unspecified') as dashboard_polarity,
      event.learning_context->>'unitId' as unit_id,
      event.learning_context->>'contentVersion' as content_version
    from public.learning_events event
    left join public.fundamentals_final_sessions final_session
      on final_session.user_id = event.user_id and final_session.session_id = event.fundamentals_session_id
    left join lateral (
      select final_session.question_order->((event.learning_context->>'position')::integer) as value
      where event.learning_context->>'kind' = 'lesson-final'
    ) final_question on true
    left join lateral (
      select plan.value->'question' as value
      from public.published_fundamentals_catalogs catalog cross join jsonb_array_elements(catalog.plan) plan(value)
      where event.learning_context->>'kind' = 'lesson-checkpoint'
        and catalog.unit_id = event.learning_context->>'unitId'
        and catalog.content_version = event.learning_context->>'contentVersion'
        and plan.value->>'id' = event.learning_context->>'stepId'
    ) checkpoint_question on true
    where event.user_id = v_user_id
  ), scoped as (
    select event.* from owner_events event cross join filters
    where (v_from is null or event.answered_at >= v_from) and event.answered_at < v_to
      and (filters.certification_ids is null or event.certification_id = any(filters.certification_ids))
      and (filters.categories is null or event.category = any(filters.categories))
      and (filters.modes is null or event.mode = any(filters.modes))
      and (filters.contexts is null or event.dashboard_context = any(filters.contexts))
      and (filters.formats is null or event.dashboard_format = any(filters.formats))
      and (filters.polarities is null or event.dashboard_polarity = any(filters.polarities))
      and (filters.unit_ids is null or event.unit_id = any(filters.unit_ids))
      and (filters.revisions = 'null'::jsonb or exists (
        select 1 from jsonb_array_elements(filters.revisions) revision(value)
        where revision.value->>'sourceVersion' = event.source_version
          and (revision.value->>'questionRevision')::integer = event.question_revision
      ))
  ), total as (
    select count(*)::bigint as answered, count(*) filter (where is_correct)::bigint as correct,
      coalesce(sum(duration_ms), 0)::bigint as duration_ms from scoped
  ), daily as (
    select (answered_at at time zone v_timezone)::date as date, count(*)::bigint as answered,
      count(*) filter (where is_correct)::bigint as correct, coalesce(sum(duration_ms), 0)::bigint as duration_ms
    from scoped group by (answered_at at time zone v_timezone)::date
  ), certifications as (
    select certification_id as key, count(*)::bigint as answered, count(*) filter (where is_correct)::bigint as correct,
      coalesce(sum(duration_ms), 0)::bigint as duration_ms from scoped group by certification_id
  ), categories as (
    select certification_id, category, source_version, question_revision, count(*)::bigint as answered,
      count(*) filter (where is_correct)::bigint as correct, coalesce(sum(duration_ms), 0)::bigint as duration_ms
    from scoped group by certification_id, category, source_version, question_revision
  ), named_groups as (
    select 'modes' as kind, mode as key, count(*)::bigint as answered, count(*) filter (where is_correct)::bigint as correct, coalesce(sum(duration_ms), 0)::bigint as duration_ms from scoped group by mode
    union all select 'contexts', dashboard_context, count(*)::bigint, count(*) filter (where is_correct)::bigint, coalesce(sum(duration_ms), 0)::bigint from scoped group by dashboard_context
    union all select 'formats', dashboard_format, count(*)::bigint, count(*) filter (where is_correct)::bigint, coalesce(sum(duration_ms), 0)::bigint from scoped group by dashboard_format
    union all select 'polarities', dashboard_polarity, count(*)::bigint, count(*) filter (where is_correct)::bigint, coalesce(sum(duration_ms), 0)::bigint from scoped group by dashboard_polarity
  ), revisions as (
    select source_version, question_revision, count(*)::bigint as answered, count(*) filter (where is_correct)::bigint as correct, coalesce(sum(duration_ms), 0)::bigint as duration_ms from scoped group by source_version, question_revision
  ), units as (
    select unit_id, content_version, count(*)::bigint as answered, count(*) filter (where is_correct)::bigint as correct, coalesce(sum(duration_ms), 0)::bigint as duration_ms from scoped where unit_id is not null and content_version is not null group by unit_id, content_version
  ), duration_quantiles as (
    select count(*)::bigint as count, min(duration_ms)::bigint as min, max(duration_ms)::bigint as max,
      percentile_cont(array[0.05, 0.25, 0.5, 0.75, 0.95]) within group (order by duration_ms) as values from scoped
  ), duration_bins as (
    select bin.lower_ms, bin.upper_ms, count(event.duration_ms)::bigint as count
    from (values
      (0, 1000), (1000, 5000), (5000, 10000), (10000, 30000),
      (30000, 60000), (60000, 120000), (120000, 300000), (300000, null::integer)
    ) bin(lower_ms, upper_ms)
    left join scoped event on event.duration_ms >= bin.lower_ms and (bin.upper_ms is null or event.duration_ms < bin.upper_ms)
    group by bin.lower_ms, bin.upper_ms
  ), review_events as (
    select event.*, count(*) over review_window as answered, count(*) filter (where not is_correct) over review_window as incorrect_count,
      row_number() over review_window_order as ordinal
    from scoped event where dashboard_context <> 'exam'
    window review_window as (partition by certification_id, question_id, question_revision, source_version),
      review_window_order as (partition by certification_id, question_id, question_revision, source_version order by answered_at desc, event_id desc)
  ), scoped_exam_ids as (
    select distinct exam_id from scoped where dashboard_context = 'exam' and exam_id is not null
  ), scoped_exam_stats as (
    select event.exam_id, count(*)::bigint as answered, count(*) filter (where event.is_correct)::bigint as correct,
      coalesce(sum(event.duration_ms), 0)::bigint as duration_ms
    from scoped event join scoped_exam_ids ids using (exam_id) group by event.exam_id
  ), all_exam_stats as (
    select event.exam_id, count(*)::bigint as answered, count(*) filter (where event.is_correct)::bigint as correct,
      coalesce(sum(event.duration_ms), 0)::bigint as duration_ms, max(event.answered_at) as last_answered_at
    from owner_events event join scoped_exam_ids ids using (exam_id) group by event.exam_id
  ), exams as (
    select session.exam_id, session.certification_id, session.source_version, session.started_at, session.submitted_at,
      all_stats.last_answered_at, jsonb_array_length(session.question_order) as question_count,
      public.dashboard_stats_json(scoped_stats.answered, scoped_stats.correct, scoped_stats.duration_ms) as stats,
      public.dashboard_stats_json(all_stats.answered, all_stats.correct, all_stats.duration_ms) as all_answers
    from scoped_exam_ids ids join public.exam_sessions session on session.user_id = v_user_id and session.exam_id = ids.exam_id
    join scoped_exam_stats scoped_stats on scoped_stats.exam_id = session.exam_id
    join all_exam_stats all_stats on all_stats.exam_id = session.exam_id
    where session.state = 'submitted'
  ), scoped_lesson_ids as (
    select distinct fundamentals_session_id as session_id from scoped
    where dashboard_context = 'lesson-final' and fundamentals_session_id is not null
  ), scoped_lesson_stats as (
    select event.fundamentals_session_id as session_id, count(*)::bigint as answered, count(*) filter (where event.is_correct)::bigint as correct,
      coalesce(sum(event.duration_ms), 0)::bigint as duration_ms
    from scoped event join scoped_lesson_ids ids on ids.session_id = event.fundamentals_session_id group by event.fundamentals_session_id
  ), all_lesson_stats as (
    select event.fundamentals_session_id as session_id, count(*)::bigint as answered, count(*) filter (where event.is_correct)::bigint as correct,
      coalesce(sum(event.duration_ms), 0)::bigint as duration_ms
    from owner_events event join scoped_lesson_ids ids on ids.session_id = event.fundamentals_session_id group by event.fundamentals_session_id
  ), lesson_finals as (
    select session.session_id, session.unit_id, session.content_version, session.started_at, session.submitted_at,
      session.score, session.required_score, jsonb_array_length(session.question_order) as question_count, session.passed,
      public.dashboard_stats_json(scoped_stats.answered, scoped_stats.correct, scoped_stats.duration_ms) as stats,
      public.dashboard_stats_json(all_stats.answered, all_stats.correct, all_stats.duration_ms) as all_answers
    from scoped_lesson_ids ids join public.fundamentals_final_sessions session on session.user_id = v_user_id and session.session_id = ids.session_id
    join scoped_lesson_stats scoped_stats on scoped_stats.session_id = session.session_id
    join all_lesson_stats all_stats on all_stats.session_id = session.session_id
    where session.state = 'submitted'
  ), facets as (
    select jsonb_build_object(
      'certificationIds', coalesce((select jsonb_agg(value order by value) from (select distinct certification_id as value from owner_events) facet_values), '[]'::jsonb),
      'categories', coalesce((select jsonb_agg(jsonb_build_object('certificationId', certification_id, 'category', category) order by certification_id, category) from (select distinct certification_id, category from owner_events) facet_values), '[]'::jsonb),
      'modes', coalesce((select jsonb_agg(value order by value) from (select distinct mode as value from owner_events) facet_values), '[]'::jsonb),
      'contexts', coalesce((select jsonb_agg(value order by value) from (select distinct dashboard_context as value from owner_events) facet_values), '[]'::jsonb),
      'formats', coalesce((select jsonb_agg(value order by value) from (select distinct dashboard_format as value from owner_events) facet_values), '[]'::jsonb),
      'polarities', coalesce((select jsonb_agg(value order by value) from (select distinct dashboard_polarity as value from owner_events) facet_values), '[]'::jsonb),
      'revisions', coalesce((select jsonb_agg(jsonb_build_object('sourceVersion', source_version, 'questionRevision', question_revision) order by source_version, question_revision) from (select distinct source_version, question_revision from owner_events) facet_values), '[]'::jsonb),
      'units', coalesce((select jsonb_agg(jsonb_build_object('unitId', unit_id, 'contentVersion', content_version) order by unit_id, content_version) from (select distinct unit_id, content_version from owner_events where unit_id is not null and content_version is not null) facet_values), '[]'::jsonb)
    ) as value
  ) select jsonb_build_object(
    'schemaVersion', 1, 'query', p_query,
    'total', public.dashboard_stats_json(total.answered, total.correct, total.duration_ms),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('date', date) || public.dashboard_stats_json(answered, correct, duration_ms) order by date) from daily), '[]'::jsonb),
    'groups', jsonb_build_object(
      'certifications', coalesce((select jsonb_agg(jsonb_build_object('key', key) || public.dashboard_stats_json(answered, correct, duration_ms) order by key) from certifications), '[]'::jsonb),
      'categories', coalesce((select jsonb_agg(jsonb_build_object('certificationId', certification_id, 'category', category, 'sourceVersion', source_version, 'questionRevision', question_revision) || public.dashboard_stats_json(answered, correct, duration_ms) order by certification_id, category, source_version, question_revision) from categories), '[]'::jsonb),
      'modes', coalesce((select jsonb_agg(jsonb_build_object('key', key) || public.dashboard_stats_json(answered, correct, duration_ms) order by key) from named_groups where kind = 'modes'), '[]'::jsonb),
      'contexts', coalesce((select jsonb_agg(jsonb_build_object('key', key) || public.dashboard_stats_json(answered, correct, duration_ms) order by key) from named_groups where kind = 'contexts'), '[]'::jsonb),
      'formats', coalesce((select jsonb_agg(jsonb_build_object('key', key) || public.dashboard_stats_json(answered, correct, duration_ms) order by key) from named_groups where kind = 'formats'), '[]'::jsonb),
      'polarities', coalesce((select jsonb_agg(jsonb_build_object('key', key) || public.dashboard_stats_json(answered, correct, duration_ms) order by key) from named_groups where kind = 'polarities'), '[]'::jsonb),
      'revisions', coalesce((select jsonb_agg(jsonb_build_object('sourceVersion', source_version, 'questionRevision', question_revision) || public.dashboard_stats_json(answered, correct, duration_ms) order by source_version, question_revision) from revisions), '[]'::jsonb),
      'units', coalesce((select jsonb_agg(jsonb_build_object('unitId', unit_id, 'contentVersion', content_version) || public.dashboard_stats_json(answered, correct, duration_ms) order by unit_id, content_version) from units), '[]'::jsonb)
    ),
    'duration', (select jsonb_build_object('count', count, 'min', min, 'p05', values[1], 'p25', values[2], 'p50', values[3], 'p75', values[4], 'p95', values[5], 'max', max, 'bins', coalesce((select jsonb_agg(jsonb_build_object('lowerMs', lower_ms, 'upperMs', upper_ms, 'count', count) order by lower_ms) from duration_bins), '[]'::jsonb)) from duration_quantiles),
    'review', coalesce((select jsonb_agg(jsonb_build_object('certificationId', certification_id, 'questionId', question_id, 'questionRevision', question_revision, 'sourceVersion', source_version, 'category', category, 'context', dashboard_context, 'unitId', unit_id, 'contentVersion', content_version, 'answered', answered, 'incorrectCount', incorrect_count, 'latestAnsweredAt', answered_at) order by answered_at desc, event_id desc) from review_events where ordinal = 1 and not is_correct), '[]'::jsonb),
    'exams', coalesce((select jsonb_agg(jsonb_build_object('examId', exam_id, 'certificationId', certification_id, 'sourceVersion', source_version, 'startedAt', started_at, 'submittedAt', submitted_at, 'lastAnsweredAt', last_answered_at, 'questionCount', question_count, 'stats', stats, 'allAnswers', all_answers) order by submitted_at desc nulls last, last_answered_at desc nulls last) from exams), '[]'::jsonb),
    'lessonFinals', coalesce((select jsonb_agg(jsonb_build_object('sessionId', session_id, 'unitId', unit_id, 'contentVersion', content_version, 'startedAt', started_at, 'submittedAt', submitted_at, 'score', score, 'requiredScore', required_score, 'questionCount', question_count, 'passed', passed, 'stats', stats, 'allAnswers', all_answers) order by submitted_at desc) from lesson_finals), '[]'::jsonb),
    'facets', (select value from facets)
  ) into v_result from total;
  return v_result;
end $$;

revoke all on function public.dashboard_parse_timestamp(jsonb, boolean), public.dashboard_validate_text_filter(jsonb, text[], text, integer),
  public.dashboard_validate_revisions(jsonb), public.dashboard_stats_json(bigint, bigint, bigint), public.dashboard_summary(jsonb, bigint) from public, anon;
grant execute on function public.dashboard_summary(jsonb, bigint) to authenticated;
