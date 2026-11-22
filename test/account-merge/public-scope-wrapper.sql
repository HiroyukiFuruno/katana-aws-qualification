create function public.fixture_read_public_learning_scope() returns jsonb
language sql security definer set search_path = '' as $$
  select kaq_private.read_public_learning_scope()
$$;
create function public.fixture_read_account_bootstrap() returns jsonb
language sql security definer set search_path = '' as $$
  select kaq_private.read_account_bootstrap()
$$;
create function public.fixture_open_public_learning_scope(p_mode text, p_generation bigint) returns jsonb
language plpgsql security definer set search_path = pg_catalog, kaq_private as $$
declare scope jsonb;
begin
  scope := kaq_private.open_public_learning_scope(p_mode, p_generation);
  return jsonb_build_object('scope',scope,'cache_present',current_setting('kaq.public_learning_scope',true) <> '');
end $$;
create function public.fixture_nested_public_learning_scope(
  p_outer text, p_inner text, p_generation bigint
) returns jsonb language plpgsql security definer set search_path = pg_catalog, kaq_private as $$
declare cached jsonb;
begin
  if p_outer in ('writer_missing_mode','writer_null_mode') then
    perform kaq_private.open_public_learning_scope('writer',p_generation);
    cached := current_setting('kaq.public_learning_scope')::jsonb;
    cached := case when p_outer='writer_missing_mode' then cached#-'{scope,state_mode}'
      else jsonb_set(cached,'{scope,state_mode}','null'::jsonb) end;
    perform set_config('kaq.public_learning_scope',cached::text,true);
    return kaq_private.open_public_learning_scope(p_inner,p_generation);
  end if;
  return jsonb_build_object('outer',kaq_private.open_public_learning_scope(p_outer,p_generation),
    'inner',kaq_private.open_public_learning_scope(p_inner,p_generation));
end $$;
create function public.fixture_public_learning_scope_cache_probe() returns boolean
language sql security definer set search_path = pg_catalog as $$
  select current_setting('kaq.public_learning_scope',true) <> ''
$$;
revoke all on function public.fixture_read_public_learning_scope() from public, anon, authenticated, service_role;
revoke all on function public.fixture_read_account_bootstrap() from public, anon, authenticated, service_role;
revoke all on function public.fixture_open_public_learning_scope(text,bigint) from public, anon, authenticated, service_role;
revoke all on function public.fixture_nested_public_learning_scope(text,text,bigint) from public, anon, authenticated, service_role;
revoke all on function public.fixture_public_learning_scope_cache_probe() from public, anon, authenticated, service_role;
grant execute on function public.fixture_read_public_learning_scope() to authenticated;
grant execute on function public.fixture_read_account_bootstrap() to authenticated;
grant execute on function public.fixture_open_public_learning_scope(text,bigint) to authenticated;
grant execute on function public.fixture_nested_public_learning_scope(text,text,bigint) to authenticated;
grant execute on function public.fixture_public_learning_scope_cache_probe() to authenticated;
notify pgrst, 'reload schema';
