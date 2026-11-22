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

create function public.fixture_issue_learning_session_grant(
  p_reason text, p_proof_id uuid default null, p_receipt_id uuid default null
) returns jsonb language sql security definer set search_path = '' as $$
  select kaq_private.issue_learning_session_grant(p_reason, p_proof_id, p_receipt_id)
$$;
revoke all on function public.fixture_issue_learning_session_grant(text,uuid,uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.fixture_issue_learning_session_grant(text,uuid,uuid)
  to authenticated;

create function public.fixture_resolve_current_learning_grant() returns jsonb
language sql security definer set search_path = '' as $$
  select kaq_private.resolve_current_learning_grant()
$$;
revoke all on function public.fixture_resolve_current_learning_grant()
  from public, anon, authenticated, service_role;
grant execute on function public.fixture_resolve_current_learning_grant() to authenticated;
create function public.fixture_lock_account_intent_scope(
  p_intent_id uuid, p_intent_secret text, p_expected_revision bigint
) returns jsonb language sql security definer set search_path = '' as $$
  select kaq_private.lock_account_intent_scope(
    p_intent_id, p_intent_secret, p_expected_revision
  )
$$;

revoke all on function public.fixture_lock_account_intent_scope(uuid,text,bigint) from public, anon, authenticated, service_role;
grant execute on function public.fixture_lock_account_intent_scope(uuid,text,bigint) to authenticated;
create function public.fixture_read_account_intent(p_intent_id uuid, p_intent_secret text)
returns jsonb language sql security definer set search_path = '' as $$
  select kaq_private.read_account_intent(p_intent_id, p_intent_secret)
$$;
revoke all on function public.fixture_read_account_intent(uuid,text)
  from public, anon, authenticated, service_role;
grant execute on function public.fixture_read_account_intent(uuid,text) to authenticated;
notify pgrst, 'reload schema';
