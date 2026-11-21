-- #58の本人向けread-only部品。公開RPC/migrationには未接続。
-- 通常RESTのscope headerをまだ持たない初回読取専用で、履歴や他人の候補を返さない。
create function kaq_private.read_account_bootstrap() returns jsonb
language plpgsql stable security definer
set search_path = pg_catalog, auth, public, kaq_private
as $$
declare
  actor auth.sessions%rowtype;
  membership kaq_private.learning_memberships%rowtype;
  account kaq_private.learning_accounts%rowtype;
  session_grant kaq_private.learning_session_grants%rowtype;
  fence_at timestamptz; oauth_at timestamptz; account_generation bigint;
begin
  actor := kaq_private.read_actor_session();
  select * into membership from kaq_private.learning_memberships where auth_user_id = actor.user_id;
  if not found then
    return jsonb_build_object('state', 'onboarding_required');
  end if;
  if membership.status <> 'active' then
    return jsonb_build_object('state', 'disabled');
  end if;
  select * into account from kaq_private.learning_accounts where id = membership.account_id;
  if not found or account.status <> 'active' then
    return jsonb_build_object('state', 'disabled');
  end if;
  select * into session_grant from kaq_private.learning_session_grants where session_id = actor.id;
  if not found or session_grant.auth_user_id is distinct from actor.user_id
    or session_grant.account_id is distinct from membership.account_id
    or session_grant.membership_epoch is distinct from membership.epoch
    or session_grant.revoked_at is not null then
    return jsonb_build_object('state', 'reauthentication_required');
  end if;
  fence_at := greatest(account.session_fence_at, membership.session_fence_at);
  if fence_at is not null then
    select updated_at into oauth_at from auth.mfa_amr_claims
      where session_id = actor.id and authentication_method = 'oauth';
    if not isfinite(fence_at) or actor.created_at <= fence_at
      or oauth_at is null or not isfinite(oauth_at) or oauth_at <= fence_at then
      return jsonb_build_object('state', 'reauthentication_required');
    end if;
  end if;
  select generation into account_generation from public.learning_state where user_id = account.id;
  if not found then
    -- active accountのstate不在をonboardingへ変換して別accountを作らせない。
    raise exception using errcode = 'PT500', message = 'KAQ_ACCOUNT_STATE_MISSING';
  end if;
  return jsonb_build_object('state', 'ready', 'account_id', account.id,
    'membership_epoch', membership.epoch, 'generation', account_generation);
end $$;
revoke all on function kaq_private.read_account_bootstrap() from public, anon, authenticated, service_role;

-- grant/enroll/createの副作用を持たず、失効した旧sessionに最新scopeを自動交付しない。
-- STABLE snapshotの本人向け状態通知だけであり、writerのlock後検査やAuth policy refreshを代替しない。
