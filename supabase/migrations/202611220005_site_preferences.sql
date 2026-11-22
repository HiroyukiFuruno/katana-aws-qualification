-- 表示設定は学習・ダッシュボード配置と独立して同じ本人行へ保存する。
alter table public.dashboard_settings
  add column site_locale text check (site_locale is null or site_locale in ('en', 'ja', 'zh-CN', 'zh-TW', 'ko', 'pt', 'fr', 'de', 'es', 'it')),
  add column site_theme text check (site_theme is null or site_theme in ('light', 'dark')),
  add column site_revision bigint not null default 0 check (site_revision >= 0);

create function public.load_site_preferences(p_expected_generation bigint)
returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare
  v_user_id uuid := public.require_learning_generation(p_expected_generation);
  v_settings public.dashboard_settings%rowtype;
begin
  select * into v_settings from public.dashboard_settings where user_id = v_user_id;
  return jsonb_build_object(
    'locale', v_settings.site_locale,
    'theme', v_settings.site_theme,
    'revision', coalesce(v_settings.site_revision, 0)
  );
end $$;

create function public.save_site_preferences(
  p_locale text, p_theme text, p_expected_revision bigint, p_expected_generation bigint
)
returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare
  v_user_id uuid := public.require_learning_generation(p_expected_generation);
  v_settings public.dashboard_settings%rowtype;
begin
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'invalid site preferences revision' using errcode = '22023';
  end if;
  if p_locale is not null and p_locale not in ('en', 'ja', 'zh-CN', 'zh-TW', 'ko', 'pt', 'fr', 'de', 'es', 'it') then
    raise exception 'invalid site locale' using errcode = '22023';
  end if;
  if p_theme is not null and p_theme not in ('light', 'dark') then
    raise exception 'invalid site theme' using errcode = '22023';
  end if;
  insert into public.dashboard_settings(user_id) values (v_user_id) on conflict do nothing;
  select * into v_settings from public.dashboard_settings where user_id = v_user_id for update;
  if v_settings.site_locale is not distinct from p_locale and v_settings.site_theme is not distinct from p_theme then
    return jsonb_build_object('locale', v_settings.site_locale, 'theme', v_settings.site_theme, 'revision', v_settings.site_revision);
  end if;
  if v_settings.site_revision <> p_expected_revision then
    raise exception 'stale site preferences' using errcode = 'PT412';
  end if;
  update public.dashboard_settings
    set site_locale = p_locale, site_theme = p_theme, site_revision = site_revision + 1
    where user_id = v_user_id
    returning * into v_settings;
  return jsonb_build_object('locale', v_settings.site_locale, 'theme', v_settings.site_theme, 'revision', v_settings.site_revision);
end $$;

revoke all on function public.load_site_preferences(bigint), public.save_site_preferences(text, text, bigint, bigint) from public, anon;
grant execute on function public.load_site_preferences(bigint), public.save_site_preferences(text, text, bigint, bigint) to authenticated;
