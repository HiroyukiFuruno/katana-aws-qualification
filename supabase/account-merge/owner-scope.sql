-- #58のread snapshot専用下書き。公開RPC/migration/既存RLSへは未接続。
-- request.jwt.claims/request.headersは同一projectの署名・issuer等を検証したREST/Edgeが設定する信頼境界。
-- DB接続者が任意に設定したGUCや生JWT文字列を認証する部品ではない。任意UID引数も設けない。
create function kaq_private.read_actor_session() returns auth.sessions
language plpgsql stable security definer
set search_path = pg_catalog, auth, kaq_private
as $$
declare
  claims jsonb; actor_uid uuid; actor_session uuid; expires_at bigint; valid_audience boolean := false;
  live_user auth.users%rowtype; live_session auth.sessions%rowtype;
  checked_at timestamptz := statement_timestamp();
begin
  begin
    claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
    if jsonb_typeof(claims) is distinct from 'object'
      or jsonb_typeof(claims -> 'sub') is distinct from 'string'
      or jsonb_typeof(claims -> 'session_id') is distinct from 'string'
      or claims ->> 'role' is distinct from 'authenticated'
      or jsonb_typeof(claims -> 'exp') is distinct from 'number'
      or (claims ->> 'exp') !~ '^[0-9]+$' then
      raise exception using errcode = '28000', message = 'KAQ_AUTH_CONTEXT_INVALID';
    end if;
    actor_uid := (claims ->> 'sub')::uuid;
    actor_session := (claims ->> 'session_id')::uuid;
    expires_at := (claims ->> 'exp')::bigint;
    case jsonb_typeof(claims -> 'aud')
      when 'string' then valid_audience := claims ->> 'aud' = 'authenticated';
      when 'array' then
        select bool_and(jsonb_typeof(value) = 'string') and bool_or(value = '"authenticated"'::jsonb)
          into valid_audience from jsonb_array_elements(claims -> 'aud');
      else valid_audience := false;
    end case;
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception using errcode = '28000', message = 'KAQ_AUTH_CONTEXT_INVALID';
  end;
  if actor_uid is null or actor_session is null
    or actor_uid = '00000000-0000-0000-0000-000000000000'::uuid
    or actor_session = '00000000-0000-0000-0000-000000000000'::uuid
    or valid_audience is distinct from true or expires_at <= extract(epoch from checked_at) then
    raise exception using errcode = '28000', message = 'KAQ_AUTH_CONTEXT_INVALID';
  end if;

  -- assert_live_session(false)相当の基本条件をsnapshotで読む。行lockや機微操作のMFA検査は行わない。
  select * into live_user from auth.users where id = actor_uid;
  if not found then
    raise exception using errcode = '28000', message = 'KAQ_SESSION_INVALID';
  end if;
  select * into live_session from auth.sessions where id = actor_session;
  if not found or live_session.user_id is distinct from actor_uid
    or live_user.deleted_at is not null or live_user.banned_until > checked_at
    or live_session.created_at is null or not isfinite(live_session.created_at)
    or live_session.created_at <= 'epoch'::timestamptz
    or live_session.created_at > checked_at + interval '5 seconds'
    or (live_session.not_after is not null and (
      not isfinite(live_session.not_after) or live_session.not_after <= checked_at
    )) or live_session.oauth_client_id is not null then
    raise exception using errcode = '28000', message = 'KAQ_SESSION_INVALID';
  end if;
  return live_session;
end $$;
revoke all on function kaq_private.read_actor_session() from public, anon, authenticated, service_role;

create function kaq_private.read_learning_account() returns uuid
language plpgsql stable security definer
set search_path = pg_catalog, auth, kaq_private
as $$
declare
  actor auth.sessions%rowtype;
  membership kaq_private.learning_memberships%rowtype;
  account kaq_private.learning_accounts%rowtype;
  session_grant kaq_private.learning_session_grants%rowtype;
  headers jsonb; has_account boolean; has_epoch boolean; expected_account uuid; expected_epoch bigint;
  fence_at timestamptz; oauth_at timestamptz;
begin
  actor := kaq_private.read_actor_session();
  begin
    headers := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
    if jsonb_typeof(headers) is distinct from 'object' then
      raise exception using errcode = 'PT403', message = 'KAQ_SCOPE_INVALID';
    end if;
    has_account := headers ? 'x-kaq-account-id';
    has_epoch := headers ? 'x-kaq-membership-epoch';
    if has_account or has_epoch then
      if not (has_account and has_epoch)
        or jsonb_typeof(headers -> 'x-kaq-account-id') is distinct from 'string'
        or jsonb_typeof(headers -> 'x-kaq-membership-epoch') is distinct from 'string'
        or (headers ->> 'x-kaq-membership-epoch') !~ '^(0|[1-9][0-9]*)$' then
        raise exception using errcode = 'PT403', message = 'KAQ_SCOPE_INVALID';
      end if;
      expected_account := (headers ->> 'x-kaq-account-id')::uuid;
      expected_epoch := (headers ->> 'x-kaq-membership-epoch')::bigint;
    end if;
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception using errcode = 'PT403', message = 'KAQ_SCOPE_INVALID';
  end;

  select * into membership from kaq_private.learning_memberships where auth_user_id = actor.user_id;
  if not found then
    raise exception using errcode = 'PT409', message = 'KAQ_ONBOARDING_REQUIRED';
  end if;
  if membership.status <> 'active' then
    raise exception using errcode = 'PT403', message = 'KAQ_ACCOUNT_DISABLED';
  end if;
  select * into account from kaq_private.learning_accounts where id = membership.account_id;
  if not found or account.status <> 'active' then
    raise exception using errcode = 'PT403', message = 'KAQ_ACCOUNT_DISABLED';
  end if;
  select * into session_grant from kaq_private.learning_session_grants where session_id = actor.id;
  if not found or session_grant.auth_user_id is distinct from actor.user_id
    or session_grant.account_id is distinct from membership.account_id
    or session_grant.membership_epoch is distinct from membership.epoch
    or session_grant.revoked_at is not null then
    raise exception using errcode = 'PT401', message = 'KAQ_REAUTHENTICATION_REQUIRED';
  end if;
  fence_at := greatest(account.session_fence_at, membership.session_fence_at);
  if fence_at is not null then
    select updated_at into oauth_at from auth.mfa_amr_claims
      where session_id = actor.id and authentication_method = 'oauth';
    if not isfinite(fence_at) or actor.created_at <= fence_at
      or oauth_at is null or not isfinite(oauth_at) or oauth_at <= fence_at then
      raise exception using errcode = 'PT401', message = 'KAQ_REAUTHENTICATION_REQUIRED';
    end if;
  end if;

  if has_account then
    if expected_account is distinct from account.id or expected_epoch is distinct from membership.epoch then
      raise exception using errcode = 'PT403', message = 'KAQ_SCOPE_INVALID';
    end if;
  elsif account.id <> actor.user_id or membership.epoch <> 0 or account.membership_revision <> 0
    or account.session_fence_at is not null or membership.session_fence_at is not null
    or session_grant.reason <> 'legacy' or exists (
      select 1 from kaq_private.learning_memberships where account_id = account.id and auth_user_id <> actor.user_id
    ) then
    -- 束縛なし互換を未統合1:1のlegacyだけへ限定し、最新scopeを暗黙交付しない。
    raise exception using errcode = 'PT403', message = 'KAQ_SCOPE_INVALID';
  end if;
  return account.id;
end $$;
revoke all on function kaq_private.read_learning_account() from public, anon, authenticated, service_role;
grant execute on function kaq_private.read_learning_account() to authenticated;

-- RLS保存済み式からのみ使えるACL。private schema USAGEは付与しないが、これだけで全呼出し経路を塞ぐとは言わない。
-- STABLEはstatement snapshot/statement時刻のread境界。待機後の再呼出しだけでwriterの最新再検査済みとは扱わない。
-- writer/commitは別のlocking resolverで全Auth user/session先行・state lock後の最新再検査へ参加する必要がある。
-- 本read部品の成功を全writer/公開APIへのlock統合やhosted policy判定の完了と読み替えない。
-- grant発行/更新、enroll/bootstrap/create、機微MFA、proof AMR/JWT秒照合、全scope cutoverの完成を示す部品ではない。
comment on function kaq_private.read_learning_account() is
  'RLS向けread snapshot専用。verified actor/grant/fence/headerの本人scopeのみ返す。writer locking再検査・hosted設定guard・公開cutoverは未実装。';
