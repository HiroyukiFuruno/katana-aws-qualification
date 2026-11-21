-- 実署名JWTの境界だけを専用DBで公開する。本番migrationへ含めない。
create function public.fixture_accept_account_proof(
  p_intent_id uuid, p_leg_id uuid, p_ingest_nonce bytea, p_expected_leg_revision bigint
) returns jsonb language sql security definer set search_path = '' as $$
  select kaq_private.accept_account_proof(
    p_intent_id, p_leg_id, p_ingest_nonce, p_expected_leg_revision
  )
$$;
revoke all on function public.fixture_accept_account_proof(uuid,uuid,bytea,bigint)
  from public, anon, authenticated, service_role;
grant execute on function public.fixture_accept_account_proof(uuid,uuid,bytea,bigint)
  to authenticated;
notify pgrst, 'reload schema';
