-- 実署名JWTによる native fixture 専用。migration/public API へ含めない。
create function public.fixture_create_learning_account(p_consent boolean, p_request_key uuid) returns jsonb
language sql security definer set search_path = '' as $$
  select kaq_private.create_learning_account(p_consent, p_request_key)
$$;
revoke all on function public.fixture_create_learning_account(boolean,uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.fixture_create_learning_account(boolean,uuid) to authenticated;
notify pgrst, 'reload schema';
