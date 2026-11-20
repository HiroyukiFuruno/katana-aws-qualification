-- #24 の配置設定は学習記録とは別の所有者正本であり、resetでは消さず退会でだけ消える。

create table public.dashboard_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 0 check (revision >= 0),
  settings jsonb check (settings is null or jsonb_typeof(settings) = 'object'),
  updated_at timestamptz not null default clock_timestamp()
);

alter table public.dashboard_settings enable row level security;
create policy dashboard_settings_read on public.dashboard_settings for select to authenticated using (user_id = auth.uid());
revoke all on public.dashboard_settings from public, anon, authenticated;
grant select on public.dashboard_settings to authenticated;

create function public.dashboard_validate_settings_filters(p_filters jsonb, p_partial boolean)
returns void
language plpgsql stable security definer set search_path = public, auth as $$
declare v_timezone text;
begin
  if p_filters is null or jsonb_typeof(p_filters) <> 'object'
    or exists (
      select 1 from jsonb_object_keys(p_filters) key
      where key not in ('period', 'timezone', 'certificationIds', 'categories', 'modes', 'contexts', 'formats', 'polarities', 'revisions', 'unitIds')
    )
    or (not p_partial and p_filters <> jsonb_build_object(
      'period', p_filters->'period', 'timezone', p_filters->'timezone',
      'certificationIds', p_filters->'certificationIds', 'categories', p_filters->'categories',
      'modes', p_filters->'modes', 'contexts', p_filters->'contexts', 'formats', p_filters->'formats',
      'polarities', p_filters->'polarities', 'revisions', p_filters->'revisions', 'unitIds', p_filters->'unitIds'
    )) then
    raise exception 'invalid dashboard filters' using errcode = '22023';
  end if;
  if p_filters ? 'period' and (jsonb_typeof(p_filters->'period') <> 'string' or p_filters->>'period' not in ('7d', '30d', '90d', 'all')) then
    raise exception 'invalid dashboard period' using errcode = '22023';
  end if;
  if p_filters ? 'timezone' then
    v_timezone := nullif(p_filters->>'timezone', '');
    if jsonb_typeof(p_filters->'timezone') <> 'string' or v_timezone is null
      or not exists (select 1 from pg_timezone_names where name = v_timezone) then
      raise exception 'invalid dashboard timezone' using errcode = '22023';
    end if;
  end if;
  if not p_partial or p_filters ? 'certificationIds' then perform public.dashboard_validate_text_filter(p_filters->'certificationIds', null, 'certificationIds', 120); end if;
  if not p_partial or p_filters ? 'categories' then perform public.dashboard_validate_text_filter(p_filters->'categories', null, 'categories', 200); end if;
  if not p_partial or p_filters ? 'modes' then perform public.dashboard_validate_text_filter(p_filters->'modes', array['study', 'review', 'exam'], 'modes', 20); end if;
  if not p_partial or p_filters ? 'contexts' then perform public.dashboard_validate_text_filter(p_filters->'contexts', array['practice', 'exam', 'lesson-checkpoint', 'lesson-final'], 'contexts', 40); end if;
  if not p_partial or p_filters ? 'formats' then perform public.dashboard_validate_text_filter(p_filters->'formats', array['choice-single', 'choice-multiple', 'ordering', 'matching', 'unknown'], 'formats', 40); end if;
  if not p_partial or p_filters ? 'polarities' then perform public.dashboard_validate_text_filter(p_filters->'polarities', array['correct', 'incorrect', 'unspecified'], 'polarities', 20); end if;
  if not p_partial or p_filters ? 'revisions' then perform public.dashboard_validate_revisions(p_filters->'revisions'); end if;
  if not p_partial or p_filters ? 'unitIds' then perform public.dashboard_validate_text_filter(p_filters->'unitIds', null, 'unitIds', 120); end if;
end $$;

create function public.dashboard_widget_compatible(p_kind text, p_chart text, p_metric text)
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
    else false
  end
  and (p_chart <> 'radar' or p_metric = 'accuracy')
  and (p_chart <> 'stacked' or p_metric = any(array['answered', 'accuracy']))
  and (p_chart <> 'donut' or p_metric = any(array['answered', 'correct', 'incorrect', 'durationMs']));
$$;

create function public.dashboard_validate_settings(p_settings jsonb)
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
      or jsonb_typeof(v_widget->'kind') <> 'string' or v_widget->>'kind' not in ('overview', 'trend', 'calendar', 'certifications', 'categories', 'modes', 'contexts', 'formats', 'revisions', 'durations', 'relationship', 'reviews', 'exams', 'lessons')
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
    perform public.dashboard_validate_settings_filters(v_widget->'overrides', true);
  end loop;
end $$;

create function public.load_dashboard_settings(p_expected_generation bigint)
returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare v_user_id uuid := public.require_learning_generation(p_expected_generation); v_settings public.dashboard_settings%rowtype;
begin
  select * into v_settings from public.dashboard_settings where user_id = v_user_id;
  return jsonb_build_object('revision', coalesce(v_settings.revision, 0), 'settings', v_settings.settings);
end $$;

create function public.save_dashboard_settings(p_settings jsonb, p_expected_revision bigint, p_expected_generation bigint)
returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare v_user_id uuid := public.require_learning_generation(p_expected_generation); v_settings public.dashboard_settings%rowtype;
begin
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'invalid dashboard settings revision' using errcode = '22023';
  end if;
  perform public.dashboard_validate_settings(p_settings);
  insert into public.dashboard_settings(user_id) values (v_user_id) on conflict do nothing;
  select * into v_settings from public.dashboard_settings where user_id = v_user_id for update;
  if v_settings.settings is not distinct from p_settings then
    return jsonb_build_object('revision', v_settings.revision, 'settings', v_settings.settings);
  end if;
  if v_settings.revision <> p_expected_revision then
    raise exception 'stale dashboard settings' using errcode = 'PT412';
  end if;
  update public.dashboard_settings set settings = p_settings, revision = revision + 1, updated_at = clock_timestamp()
    where user_id = v_user_id returning * into v_settings;
  return jsonb_build_object('revision', v_settings.revision, 'settings', v_settings.settings);
end $$;

revoke all on function public.dashboard_validate_settings_filters(jsonb, boolean), public.dashboard_widget_compatible(text, text, text),
  public.dashboard_validate_settings(jsonb), public.load_dashboard_settings(bigint), public.save_dashboard_settings(jsonb, bigint, bigint) from public, anon;
grant execute on function public.load_dashboard_settings(bigint), public.save_dashboard_settings(jsonb, bigint, bigint) to authenticated;
