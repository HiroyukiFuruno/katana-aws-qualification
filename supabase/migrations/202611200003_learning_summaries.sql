-- 集計は所有者・UTC範囲・modeをSQLで固定し、ページングした生イベントへ委ねない。
create or replace function public.summary_user(
  p_from timestamptz, p_to timestamptz, p_modes text[], p_display_timezone text, p_certification_id text
) returns uuid language plpgsql stable security definer set search_path = public, auth as $$
declare v_user_id uuid := public.require_learning_user();
begin
  if p_from is null or p_to is null or p_to <= p_from
    or coalesce(array_length(p_modes, 1), 0) = 0
    or exists (select 1 from unnest(p_modes) as selected_mode(mode) where selected_mode.mode is null or selected_mode.mode not in ('study', 'review', 'exam'))
    or (select count(*) from unnest(p_modes)) <> (select count(distinct selected_mode.mode) from unnest(p_modes) as selected_mode(mode))
    or (p_certification_id is not null and length(p_certification_id) not between 1 and 80)
    or not exists (select 1 from pg_timezone_names where name = p_display_timezone) then
    raise exception 'invalid summary range or dimensions' using errcode = '22023';
  end if;
  return v_user_id;
end $$;

create or replace function public.learning_summary(
  p_from timestamptz, p_to timestamptz, p_modes text[] default array['study', 'review', 'exam'],
  p_display_timezone text default 'UTC', p_certification_id text default null
) returns jsonb language sql stable security definer set search_path = public, auth as $$
  with caller as (
    select public.summary_user(p_from, p_to, p_modes, p_display_timezone, p_certification_id) as user_id
  ), scoped as (
    select event.* from public.learning_events event cross join caller
    where event.user_id = caller.user_id and event.answered_at >= p_from and event.answered_at < p_to
      and event.mode = any(p_modes) and (p_certification_id is null or event.certification_id = p_certification_id)
  ), totals as (
    select count(*)::integer as answered, count(*) filter (where is_correct)::integer as correct,
      coalesce(sum(duration_ms), 0)::bigint as duration_ms from scoped
  ), by_mode as (
    select mode, count(*)::integer as answered, count(*) filter (where is_correct)::integer as correct,
      coalesce(sum(duration_ms), 0)::bigint as duration_ms from scoped group by mode
  ), by_category as (
    select certification_id, category, source_version, question_revision, count(*)::integer as answered,
      count(*) filter (where is_correct)::integer as correct, coalesce(sum(duration_ms), 0)::bigint as duration_ms
    from scoped group by certification_id, category, source_version, question_revision
  ), daily as (
    select (answered_at at time zone p_display_timezone)::date as display_day, count(*)::integer as answered,
      count(*) filter (where is_correct)::integer as correct, coalesce(sum(duration_ms), 0)::bigint as duration_ms
    from scoped group by (answered_at at time zone p_display_timezone)::date
  ), exams as (
    select session.exam_id, session.started_at, session.submitted_at, count(*)::integer as answered,
      count(*) filter (where event.is_correct)::integer as correct
    from scoped event join public.exam_sessions session on session.user_id = event.user_id and session.exam_id = event.exam_id
    where event.mode = 'exam' group by session.exam_id, session.started_at, session.submitted_at
  ) select jsonb_build_object(
    'range', jsonb_build_object('from', p_from, 'to', p_to, 'modes', p_modes, 'displayTimezone', p_display_timezone,
      'certificationId', p_certification_id),
    'total', (select jsonb_build_object('answered', answered, 'correct', correct,
      'accuracy', case when answered = 0 then null else correct::numeric / answered end,
      'durationMs', duration_ms, 'meanDurationMs', case when answered = 0 then null else duration_ms::numeric / answered end) from totals),
    'byMode', coalesce((select jsonb_agg(jsonb_build_object('mode', mode, 'answered', answered, 'correct', correct,
      'accuracy', case when answered = 0 then null else correct::numeric / answered end, 'durationMs', duration_ms) order by mode) from by_mode), '[]'::jsonb),
    'byCategory', coalesce((select jsonb_agg(jsonb_build_object('certificationId', certification_id, 'category', category,
      'sourceVersion', source_version, 'questionRevision', question_revision, 'answered', answered, 'correct', correct,
      'accuracy', case when answered = 0 then null else correct::numeric / answered end, 'durationMs', duration_ms)
      order by certification_id, category, source_version, question_revision) from by_category), '[]'::jsonb),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('date', display_day, 'answered', answered, 'correct', correct,
      'durationMs', duration_ms) order by display_day) from daily), '[]'::jsonb),
    'exams', coalesce((select jsonb_agg(jsonb_build_object('examId', exam_id, 'startedAt', started_at, 'submittedAt', submitted_at,
      'answered', answered, 'correct', correct) order by submitted_at desc) from exams), '[]'::jsonb)
  );
$$;

create or replace function public.review_queue_by_revision(p_limit integer default 100)
returns table (
  certification_id text, question_id text, question_revision integer, category text,
  latest_answered_at timestamptz, incorrect_count bigint
) language sql stable security definer set search_path = public, auth as $$
  with caller as (select public.require_learning_user() as user_id), scoped as (
    select event.* from public.learning_events event cross join caller
    where event.user_id = caller.user_id and event.mode <> 'exam'
  ), latest as (
    select distinct on (certification_id, question_id, question_revision) * from scoped
    order by certification_id, question_id, question_revision, answered_at desc, received_at desc, event_id desc
  ) select latest.certification_id, latest.question_id, latest.question_revision, latest.category, latest.answered_at,
    (select count(*) from scoped prior where prior.certification_id = latest.certification_id
      and prior.question_id = latest.question_id and prior.question_revision = latest.question_revision and not prior.is_correct)
  from latest where not latest.is_correct order by latest.answered_at desc
  limit least(greatest(p_limit, 1), 500);
$$;

revoke all on function public.summary_user(timestamptz, timestamptz, text[], text, text),
  public.learning_summary(timestamptz, timestamptz, text[], text, text), public.review_queue_by_revision(integer) from public, anon;
grant execute on function public.learning_summary(timestamptz, timestamptz, text[], text, text),
  public.review_queue_by_revision(integer) to authenticated;
