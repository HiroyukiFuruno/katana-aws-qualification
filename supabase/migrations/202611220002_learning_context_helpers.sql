-- #58のprivate context helperだけを追加する。公開owner境界、RPC、RLS、既存writerは変更しない。
begin;
set transaction isolation level serializable;

-- #58の内部部品。公開wrapperが検証済みJWT contextを束縛し、commitは保存済み両proofも再検査する。
-- migration/公開RPCへは未接続。callerは全Auth user/session→state→account/membership順を守る。
-- 下位lockを既に持つcallerが、未取得user/sessionをこの関数で後取りしてはいけない。
-- 対象: GoTrue v2.198.0 (387e91f37e00b64b9060352988066bbb685f6e45)。
-- oauth_client_idは同版20250904133000_add_oauth_client_id_to_session.up.sqlの正式列を使う。
-- https://github.com/supabase/auth/blob/387e91f37e00b64b9060352988066bbb685f6e45/migrations/20250904133000_add_oauth_client_id_to_session.up.sql
create function kaq_private.assert_live_session(
  user_uuid uuid, session_uuid uuid, sensitive boolean default false
) returns auth.sessions
language plpgsql security definer
set search_path = pg_catalog, auth, kaq_private
as $$
declare
  live_user auth.users%rowtype;
  live_session auth.sessions%rowtype;
  has_verified_factor boolean := false;
  checked_at timestamptz;
begin
  if user_uuid is null or session_uuid is null or sensitive is null
    or user_uuid = '00000000-0000-0000-0000-000000000000'::uuid
    or session_uuid = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception using errcode = '28000', message = 'KAQ_SESSION_INVALID';
  end if;

  -- KEY SHAREではban/not_after更新を止められないため、検査終了までSHAREを保持する。
  select * into live_user from auth.users where id = user_uuid for share;
  if not found then
    raise exception using errcode = '28000', message = 'KAQ_SESSION_INVALID';
  end if;
  -- GoTrue refreshはsession UPDATEを先取りしてからuserを更新する。user SHARE保持中は待たずretryへ戻す。
  begin
    select * into live_session from auth.sessions where id = session_uuid for share nowait;
  exception when lock_not_available then
    raise exception using errcode = 'PT409', message = 'KAQ_SCOPE_RETRY';
  end;
  if not found or live_session.user_id is distinct from user_uuid then
    raise exception using errcode = '28000', message = 'KAQ_SESSION_INVALID';
  end if;
  if sensitive then
    perform 1 from auth.mfa_factors where user_id = user_uuid and status = 'verified'
      order by id for share;
    has_verified_factor := found;
  end if;

  -- transaction開始時刻やlock待ち前の時刻で、待機中に切れた期限を許可しない。
  checked_at := clock_timestamp();
  if live_user.deleted_at is not null
    or live_user.banned_until > checked_at
    or live_session.created_at is null
    or not isfinite(live_session.created_at)
    or live_session.created_at <= 'epoch'::timestamptz
    or live_session.created_at > checked_at + interval '5 seconds'
    or (live_session.not_after is not null and (
      not isfinite(live_session.not_after) or live_session.not_after <= checked_at
    ))
    or live_session.oauth_client_id is not null then
    raise exception using errcode = '28000', message = 'KAQ_SESSION_INVALID';
  end if;

  -- hosted低AAL期限の実効durationを推測せず、機微操作だけ到達可能なAAL2を要求する。
  if sensitive and has_verified_factor
    and coalesce(live_session.aal, 'aal1'::auth.aal_level) < 'aal2'::auth.aal_level then
    raise exception using errcode = '28000', message = 'KAQ_STEP_UP_REQUIRED';
  end if;
  return live_session;
end $$;
revoke all on function kaq_private.assert_live_session(uuid, uuid, boolean)
  from public, anon, authenticated, service_role;

-- 2026-11-20T21:53:19.339Zの設定snapshotではtimebox/inactivity=0、single-per-user=false。
-- この部品はそれらの有効化、hosted設定変更、legacy refresh時刻、single-session集合を扱わない。
-- 機微APIの公式policy refresh/結果不明時の再証明/設定変更互換性はcallerの未実装契約。
-- user/session/factor行lockは設定変更やfactor/sessionの並行insertを防ぐものではない。
comment on function kaq_private.assert_live_session(uuid, uuid, boolean) is
  '内部owner専用。Auth UID/session所有・削除・ban・固定期限・第三者OAuth・機微操作のAALを検査。hosted設定guardと全session policyの実装ではなく、公開APIには未接続。';

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

-- #58のowner-only下書き。公開API/既存writerには未接続。対象proof/intent/digest/consentの認可は内部callerの責務。
-- callerは下位rowを先にlockせず、state modeを最初に決めてtransactionあたり1回だけ呼ぶ。再入/lock upgradeは禁止。
-- JWT署名/issuer/projectはREST/Edgeが検証済みであること。GUCを自由に設定できるDB接続者の認証には使わない。
create function kaq_private.lock_request_context() returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog, auth, kaq_private
as $$
declare
  claims jsonb; headers jsonb; actor_uid uuid; actor_session uuid; expires_at bigint;
  audience_ok boolean := false; bound_account boolean; bound_epoch boolean;
  expected_account uuid; expected_epoch bigint;
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
      when 'string' then audience_ok := claims ->> 'aud' = 'authenticated';
      when 'array' then
        select bool_and(jsonb_typeof(value) = 'string') and bool_or(value = '"authenticated"'::jsonb)
          into audience_ok from jsonb_array_elements(claims -> 'aud');
      else audience_ok := false;
    end case;
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception using errcode = '28000', message = 'KAQ_AUTH_CONTEXT_INVALID';
  end;
  if actor_uid is null or actor_session is null or audience_ok is distinct from true
    or actor_uid = '00000000-0000-0000-0000-000000000000'::uuid
    or actor_session = '00000000-0000-0000-0000-000000000000'::uuid
    or expires_at <= extract(epoch from clock_timestamp()) then
    raise exception using errcode = '28000', message = 'KAQ_AUTH_CONTEXT_INVALID';
  end if;
  begin
    headers := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
    if jsonb_typeof(headers) is distinct from 'object' then
      raise exception using errcode = 'PT403', message = 'KAQ_SCOPE_INVALID';
    end if;
    bound_account := headers ? 'x-kaq-account-id'; bound_epoch := headers ? 'x-kaq-membership-epoch';
    if bound_account or bound_epoch then
      if not (bound_account and bound_epoch)
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
  return jsonb_build_object('actor_uid', actor_uid, 'session_id', actor_session, 'bound', bound_account,
    'expected_account', expected_account, 'expected_epoch', expected_epoch);
end $$;
revoke all on function kaq_private.lock_request_context() from public, anon, authenticated, service_role;

create function kaq_private.lock_learning_scope(
  state_mode text, expected_generation bigint, target_accounts uuid[] default null,
  related_sessions uuid[] default '{}'
) returns jsonb language plpgsql volatile security definer
set search_path = pg_catalog, auth, kaq_private
as $$
declare
  initial_context jsonb; context jsonb; actor_uid uuid; actor_session uuid; actor_account uuid;
  accounts uuid[]; candidate_uids uuid[]; current_uids uuid[]; sessions uuid[]; session_owners jsonb := '{}';
  initial_revisions jsonb; current_revisions jsonb; current_generations jsonb;
  member kaq_private.learning_memberships%rowtype; account kaq_private.learning_accounts%rowtype;
  session_grant kaq_private.learning_session_grants%rowtype; live_session auth.sessions%rowtype;
  item uuid; locked_count bigint; actor_generation bigint; fence_at timestamptz; oauth_at timestamptz;
begin
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception using errcode = 'PT400', message = 'KAQ_SCOPE_ISOLATION_UNSUPPORTED';
  end if;
  if state_mode is null or state_mode not in ('writer', 'reset', 'merge')
    or expected_generation is null or expected_generation < 0 or related_sessions is null
    or array_position(related_sessions, null) is not null then
    raise exception using errcode = 'PT400', message = 'KAQ_SCOPE_ARGUMENT_INVALID';
  end if;
  initial_context := kaq_private.lock_request_context();
  if current_setting('kaq.locking_scope_used', true) = '1' then
    raise exception using errcode = 'PT409', message = 'KAQ_SCOPE_REENTRY';
  end if;
  -- transaction-localに再入を拒否し、writer SHAREからmerge/reset UPDATEへの後付けupgradeを防ぐ。
  perform set_config('kaq.locking_scope_used', '1', true);
  actor_uid := (initial_context ->> 'actor_uid')::uuid;
  actor_session := (initial_context ->> 'session_id')::uuid;
  select account_id into actor_account from kaq_private.learning_memberships where auth_user_id = actor_uid;
  if not found then
    raise exception using errcode = 'PT409', message = 'KAQ_ONBOARDING_REQUIRED';
  end if;
  if state_mode = 'merge' then
    if target_accounts is null or cardinality(target_accounts) <> 2 or array_position(target_accounts, null) is not null then
      raise exception using errcode = 'PT400', message = 'KAQ_SCOPE_ARGUMENT_INVALID';
    end if;
    select array_agg(distinct value order by value) into accounts from unnest(target_accounts) value;
    if cardinality(accounts) <> 2 then
      raise exception using errcode = 'PT409', message = 'KAQ_SAME_ACCOUNT';
    end if;
    if not actor_account = any(accounts) then
      raise exception using errcode = 'PT403', message = 'KAQ_SCOPE_INVALID';
    end if;
  else
    if target_accounts is not null or cardinality(related_sessions) <> 0 then
      raise exception using errcode = 'PT400', message = 'KAQ_SCOPE_ARGUMENT_INVALID';
    end if;
    accounts := array[actor_account];
  end if;
  -- 同じ初期snapshotから集合とrevisionを採る。後の増減では新UIDを追加lockせず全体retryに戻す。
  select
    (select array_agg(auth_user_id order by auth_user_id) from kaq_private.learning_memberships where account_id = any(accounts)),
    (select jsonb_object_agg(id::text, membership_revision order by id) from kaq_private.learning_accounts where id = any(accounts))
    into candidate_uids, initial_revisions;
  if candidate_uids is null or not actor_uid = any(candidate_uids)
    or initial_revisions is null or (select count(*) from jsonb_object_keys(initial_revisions)) <> cardinality(accounts) then
    raise exception using errcode = 'PT409', message = 'KAQ_SCOPE_RETRY';
  end if;
  foreach item in array candidate_uids loop
    perform 1 from auth.users where id = item for share;
    if not found then raise exception using errcode = 'PT409', message = 'KAQ_SCOPE_RETRY'; end if;
  end loop;
  select array_agg(distinct value order by value) into sessions from unnest(array[actor_session] || related_sessions) value;
  foreach item in array sessions loop
    -- GoTrue refreshはsession UPDATEを先取りしてからuserを更新する。user SHARE保持中は待たずretryへ戻す。
    begin
      select * into live_session from auth.sessions where id = item for share nowait;
    exception when lock_not_available then
      raise exception using errcode = 'PT409', message = 'KAQ_SCOPE_RETRY';
    end;
    if not found then raise exception using errcode = '28000', message = 'KAQ_SESSION_INVALID'; end if;
    if not live_session.user_id = any(candidate_uids) then
      raise exception using errcode = 'PT403', message = 'KAQ_SCOPE_INVALID';
    end if;
    session_owners := session_owners || jsonb_build_object(item::text, live_session.user_id);
  end loop;
  -- Auth側がAMR更新を先取りした場合も、userを保持したまま逆順待機しない。
  begin
    perform 1 from auth.mfa_amr_claims where session_id = any(sessions)
      order by session_id, authentication_method for share nowait;
  exception when lock_not_available then
    raise exception using errcode = 'PT409', message = 'KAQ_SCOPE_RETRY';
  end;

  if state_mode = 'writer' then
    perform 1 from public.learning_state where user_id = any(accounts) order by user_id for share;
  else
    perform 1 from public.learning_state where user_id = any(accounts) order by user_id for update;
  end if;
  get diagnostics locked_count = row_count;
  if locked_count <> cardinality(accounts) then
    raise exception using errcode = 'PT409', message = 'KAQ_STATE_UNAVAILABLE';
  end if;
  if state_mode = 'merge' then
    perform 1 from kaq_private.learning_accounts where id = any(accounts) order by id for update;
    perform 1 from kaq_private.learning_memberships where account_id = any(accounts) order by auth_user_id for update;
    perform 1 from kaq_private.learning_session_grants where account_id = any(accounts) order by session_id for update;
  else
    perform 1 from kaq_private.learning_accounts where id = any(accounts) order by id for share;
    perform 1 from kaq_private.learning_memberships where account_id = any(accounts) order by auth_user_id for share;
    perform 1 from kaq_private.learning_session_grants where account_id = any(accounts) order by session_id for share;
  end if;
  -- VOLATILEの別SQLで待機後の最新集合を読む。STABLE read_scopeの再呼出しで代用しない。
  select
    (select array_agg(auth_user_id order by auth_user_id) from kaq_private.learning_memberships where account_id = any(accounts)),
    (select jsonb_object_agg(id::text, membership_revision order by id) from kaq_private.learning_accounts where id = any(accounts))
    into current_uids, current_revisions;
  if current_uids is distinct from candidate_uids or current_revisions is distinct from initial_revisions then
    raise exception using errcode = 'PT409', message = 'KAQ_SCOPE_RETRY';
  end if;
  context := kaq_private.lock_request_context();
  if context ->> 'actor_uid' is distinct from initial_context ->> 'actor_uid'
    or context ->> 'session_id' is distinct from initial_context ->> 'session_id' then
    raise exception using errcode = '28000', message = 'KAQ_AUTH_CONTEXT_INVALID';
  end if;
  -- 下位lock後のhelper再lockは既に保有する同じuser/sessionだけ。未知UIDをここで後取りしない。
  foreach item in array sessions loop
    live_session := kaq_private.assert_live_session((session_owners ->> item::text)::uuid, item, false);
  end loop;
  live_session := kaq_private.assert_live_session(actor_uid, actor_session, false);
  select * into member from kaq_private.learning_memberships where auth_user_id = actor_uid;
  if not found or member.account_id is distinct from actor_account then
    raise exception using errcode = 'PT409', message = 'KAQ_SCOPE_RETRY';
  end if;
  if member.status <> 'active' or exists(select 1 from kaq_private.learning_accounts
    where id = any(accounts) and status <> 'active') then
    raise exception using errcode = 'PT403', message = 'KAQ_ACCOUNT_DISABLED';
  end if;
  select * into account from kaq_private.learning_accounts where id = actor_account;
  select * into session_grant from kaq_private.learning_session_grants where session_id = actor_session;
  if not found or session_grant.auth_user_id is distinct from actor_uid
    or session_grant.account_id is distinct from actor_account or session_grant.membership_epoch is distinct from member.epoch
    or session_grant.revoked_at is not null then
    raise exception using errcode = 'PT401', message = 'KAQ_REAUTHENTICATION_REQUIRED';
  end if;
  fence_at := greatest(account.session_fence_at, member.session_fence_at);
  if fence_at is not null then
    select updated_at into oauth_at from auth.mfa_amr_claims
      where session_id = actor_session and authentication_method = 'oauth';
    if not isfinite(fence_at) or live_session.created_at <= fence_at or oauth_at is null
      or not isfinite(oauth_at) or oauth_at <= fence_at then
      raise exception using errcode = 'PT401', message = 'KAQ_REAUTHENTICATION_REQUIRED';
    end if;
  end if;
  if (context ->> 'bound')::boolean then
    if (context ->> 'expected_account')::uuid is distinct from actor_account
      or (context ->> 'expected_epoch')::bigint is distinct from member.epoch then
      raise exception using errcode = 'PT403', message = 'KAQ_SCOPE_INVALID';
    end if;
  elsif actor_account <> actor_uid or member.epoch <> 0 or account.membership_revision <> 0
    or account.session_fence_at is not null or member.session_fence_at is not null or session_grant.reason <> 'legacy'
    or exists(select 1 from kaq_private.learning_memberships where account_id = actor_account and auth_user_id <> actor_uid) then
    raise exception using errcode = 'PT403', message = 'KAQ_SCOPE_INVALID';
  end if;
  select generation into actor_generation from public.learning_state where user_id = actor_account;
  if actor_generation is distinct from expected_generation then
    raise exception using errcode = 'PT409', message = 'KAQ_GENERATION_STALE';
  end if;
  select jsonb_object_agg(user_id::text, generation order by user_id) into current_generations
    from public.learning_state where user_id = any(accounts);
  return jsonb_build_object('account_id', actor_account, 'actor_uid', actor_uid, 'session_id', actor_session,
    'membership_epoch', member.epoch, 'generation', actor_generation, 'state_mode', state_mode,
    'account_ids', accounts, 'member_uids', current_uids, 'membership_revisions', current_revisions,
    'generations', current_generations);
end $$;
revoke all on function kaq_private.lock_learning_scope(text, bigint, uuid[], uuid[])
  from public, anon, authenticated, service_role;

-- 未対応: 全callerのREAD COMMITTED/lock順への接続、OAuth二者proof/機微MFA、hosted設定guard、全Auth APIとの原子性。
-- merge他方のproof/grant/epoch/fence/完全digest/consentはcallerでの追加検査が必要。この部品だけでmergeを認可しない。
-- 現公開learning_state.user_id FKはauth.users親のまま。logical account FKへのcutoverは別作業。

commit;
