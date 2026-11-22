-- #60 の予定表示は既存ダッシュボードの保存契約を拡張するだけで、保存済み設定は変更しない。
create or replace function public.dashboard_widget_compatible(p_kind text, p_chart text, p_metric text)
returns boolean
language sql immutable security definer set search_path = public, auth as $$
  select case p_kind
    when 'overview' then p_chart = 'metrics' and p_metric = 'answered'
    when 'trend' then p_chart = any(array['line', 'bar', 'area']) and p_metric = any(array['answered', 'correct', 'incorrect', 'accuracy', 'durationMs', 'meanDurationMs'])
    when 'calendar' then p_chart = 'heatmap' and p_metric = any(array['answered', 'durationMs'])
    when 'certifications' then p_chart = any(array['bar', 'stacked', 'donut']) and p_metric = any(array['answered', 'correct', 'incorrect', 'accuracy', 'durationMs', 'meanDurationMs'])
    when 'categories' then p_chart = any(array['bar', 'stacked', 'radar']) and p_metric = any(array['answered', 'correct', 'incorrect', 'accuracy', 'durationMs', 'meanDurationMs'])
    when 'modes' then p_chart = any(array['donut', 'stacked']) and p_metric = any(array['answered', 'correct', 'durationMs'])
    when 'contexts' then p_chart = any(array['donut', 'stacked']) and p_metric = any(array['answered', 'correct', 'durationMs'])
    when 'formats' then p_chart = any(array['bar', 'stacked', 'donut']) and p_metric = any(array['answered', 'correct', 'incorrect', 'accuracy', 'durationMs', 'meanDurationMs'])
    when 'revisions' then p_chart = any(array['bar', 'stacked']) and p_metric = any(array['answered', 'correct', 'incorrect', 'accuracy', 'durationMs', 'meanDurationMs'])
    when 'durations' then p_chart = any(array['histogram', 'box']) and p_metric = 'durationMs'
    when 'relationship' then p_chart = any(array['scatter', 'bubble']) and p_metric = 'meanDurationMs'
    when 'reviews' then p_chart = any(array['table', 'bar']) and p_metric = 'incorrect'
    when 'exams' then p_chart = any(array['line', 'bar', 'table']) and p_metric = any(array['accuracy', 'durationMs'])
    when 'lessons' then p_chart = any(array['bar', 'ring', 'table']) and p_metric = 'answered'
    when 'milestones' then p_chart = any(array['calendar', 'table']) and p_metric = 'answered'
    else false
  end
  and (p_chart <> 'radar' or p_metric = 'accuracy')
  and (p_chart <> 'stacked' or p_metric = any(array['answered', 'accuracy']))
  and (p_chart <> 'donut' or p_metric = any(array['answered', 'correct', 'incorrect', 'durationMs']));
$$;

create or replace function public.dashboard_validate_settings(p_settings jsonb)
returns void
language plpgsql stable security definer set search_path = public, auth as $$
declare v_widget jsonb;
begin
  if p_settings is null or jsonb_typeof(p_settings) <> 'object'
    or p_settings <> jsonb_build_object('schemaVersion', p_settings->'schemaVersion', 'filters', p_settings->'filters', 'widgets', p_settings->'widgets')
    or jsonb_typeof(p_settings->'schemaVersion') <> 'number' or p_settings->>'schemaVersion' <> '1'
    or jsonb_typeof(p_settings->'filters') <> 'object'
    or jsonb_typeof(p_settings->'widgets') <> 'array' or jsonb_array_length(p_settings->'widgets') not between 1 and 20 then
    raise exception 'invalid dashboard settings' using errcode = '22023';
  end if;
  perform public.dashboard_validate_settings_filters(p_settings->'filters', false);
  if exists (
    select item.value->>'id' from jsonb_array_elements(p_settings->'widgets') item(value)
    group by item.value->>'id' having count(*) > 1
  ) then
    raise exception 'dashboard widget ids are repeated' using errcode = '22023';
  end if;
  for v_widget in select value from jsonb_array_elements(p_settings->'widgets') loop
    if jsonb_typeof(v_widget) <> 'object'
      or v_widget <> jsonb_build_object(
        'id', v_widget->'id', 'kind', v_widget->'kind', 'visible', v_widget->'visible', 'width', v_widget->'width',
        'chart', v_widget->'chart', 'metric', v_widget->'metric', 'dimension', v_widget->'dimension', 'overrides', v_widget->'overrides'
      )
      or jsonb_typeof(v_widget->'id') <> 'string' or v_widget->>'id' !~ '^[a-z0-9][a-z0-9-]{0,79}$'
      or jsonb_typeof(v_widget->'kind') <> 'string' or v_widget->>'kind' not in ('overview', 'trend', 'calendar', 'certifications', 'categories', 'modes', 'contexts', 'formats', 'revisions', 'durations', 'relationship', 'reviews', 'exams', 'lessons', 'milestones')
      or jsonb_typeof(v_widget->'visible') <> 'boolean'
      or jsonb_typeof(v_widget->'width') <> 'string' or v_widget->>'width' not in ('normal', 'wide')
      or jsonb_typeof(v_widget->'chart') <> 'string'
      or jsonb_typeof(v_widget->'metric') <> 'string'
      or jsonb_typeof(v_widget->'dimension') <> 'string' or v_widget->>'dimension' not in ('default', 'polarity')
      or (v_widget->>'dimension' = 'polarity' and v_widget->>'kind' <> 'formats')
      or jsonb_typeof(v_widget->'overrides') <> 'object'
      or not public.dashboard_widget_compatible(v_widget->>'kind', v_widget->>'chart', v_widget->>'metric') then
      raise exception 'invalid dashboard widget' using errcode = '22023';
    end if;
    if v_widget->>'kind' = 'milestones' then
      if exists (
        select 1 from jsonb_object_keys(v_widget->'overrides') key
        where key not in ('certificationIds', 'timezone')
      ) then
        raise exception 'invalid milestone dashboard overrides' using errcode = '22023';
      end if;
    end if;
    perform public.dashboard_validate_settings_filters(v_widget->'overrides', true);
  end loop;
end $$;
