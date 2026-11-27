create function public.load_fundamentals_history_summaries(
  p_current_units jsonb,
  p_expected_generation bigint
) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare
  v_user_id uuid := public.require_learning_generation(p_expected_generation);
  v_history_units jsonb;
begin
  if p_current_units is null
    or jsonb_typeof(p_current_units) <> 'array'
    or exists (
      select 1 from jsonb_array_elements(p_current_units) current_unit(value)
      where jsonb_typeof(current_unit.value) <> 'object'
        or current_unit.value <> jsonb_build_object(
          'unitId', current_unit.value->>'unitId',
          'contentVersion', current_unit.value->>'contentVersion'
        )
        or nullif(current_unit.value->>'unitId', '') is null
        or nullif(current_unit.value->>'contentVersion', '') is null
    )
    or exists (
      select 1 from jsonb_array_elements(p_current_units) current_unit(value)
      group by current_unit.value->>'unitId', current_unit.value->>'contentVersion'
      having count(*) > 1
    )
    or exists (
      select 1 from jsonb_array_elements(p_current_units) current_unit(value)
      where not exists (
        select 1 from public.published_fundamentals_catalogs catalog
        where catalog.unit_id = current_unit.value->>'unitId'
          and catalog.content_version = current_unit.value->>'contentVersion'
      )
    ) then
    raise exception 'invalid current fundamentals references' using errcode = '22023';
  end if;

  with recorded_units as (
    select progress.unit_id, progress.content_version
    from public.fundamentals_unit_progress progress
    where progress.user_id = v_user_id
    union
    select session.unit_id, session.content_version
    from public.fundamentals_final_sessions session
    where session.user_id = v_user_id
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'unitId', recorded.unit_id,
        'contentVersion', recorded.content_version
      ) order by recorded.unit_id, recorded.content_version
    ),
    '[]'::jsonb
  ) into v_history_units
  from recorded_units recorded
  join public.published_fundamentals_catalogs catalog
    on catalog.unit_id = recorded.unit_id
    and catalog.content_version = recorded.content_version
  where not exists (
    select 1 from jsonb_array_elements(p_current_units) current_unit(value)
    where current_unit.value->>'unitId' = recorded.unit_id
      and current_unit.value->>'contentVersion' = recorded.content_version
  );

  return public.load_fundamentals_progress_summaries(
    v_history_units,
    p_expected_generation
  );
end $$;

revoke all on function public.load_fundamentals_history_summaries(jsonb,bigint) from public,anon;
grant execute on function public.load_fundamentals_history_summaries(jsonb,bigint) to authenticated;

create function public.load_fundamentals_checkpoint_selection(
  p_unit_id text,
  p_content_version text,
  p_question_id text,
  p_question_revision integer,
  p_source_version text,
  p_expected_generation bigint
) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare
  v_user_id uuid := public.require_learning_generation(p_expected_generation);
begin
  return (
    select event.selected
    from public.learning_events event
    where event.user_id = v_user_id
      and event.certification_id = 'fundamentals'
      and event.learning_context->>'kind' = 'lesson-checkpoint'
      and event.learning_context->>'unitId' = p_unit_id
      and event.learning_context->>'contentVersion' = p_content_version
      and event.question_id = p_question_id
      and event.question_revision = p_question_revision
      and event.source_version = p_source_version
    order by event.answered_at desc, event.event_id desc
    limit 1
  );
end $$;

revoke all on function public.load_fundamentals_checkpoint_selection(text,text,text,integer,text,bigint) from public,anon;
grant execute on function public.load_fundamentals_checkpoint_selection(text,text,text,integer,text,bigint) to authenticated;
