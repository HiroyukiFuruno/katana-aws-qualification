-- 未登録のpublic cutover候補。公開wrapperはまだ作らず、既存private lockerのgrant判定だけを17へ統合する。
-- commit時固定のproof bindingはfence前のproof SIDを許すため、通常OAuthのcreated_at基準で一律拒否しない。
create or replace function kaq_private.lock_learning_scope(
  state_mode text, expected_generation bigint, target_accounts uuid[] default null,
  related_sessions uuid[] default '{}'
) returns jsonb language plpgsql volatile security definer
set search_path = pg_catalog, auth, kaq_private
as $$
declare
  initial_context jsonb; context jsonb; current_grant jsonb; actor_uid uuid; actor_session uuid; actor_account uuid;
  accounts uuid[]; candidate_uids uuid[]; current_uids uuid[]; sessions uuid[]; session_owners jsonb := '{}';
  initial_revisions jsonb; current_revisions jsonb; current_generations jsonb;
  member kaq_private.learning_memberships%rowtype; account kaq_private.learning_accounts%rowtype;
  session_grant kaq_private.learning_session_grants%rowtype; live_session auth.sessions%rowtype;
  item uuid; locked_count bigint; actor_generation bigint;
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
  current_grant := kaq_private.resolve_current_learning_grant();
  if (current_grant->>'account_id')::uuid is distinct from actor_account
    or (current_grant->>'membership_epoch')::bigint is distinct from member.epoch then
    raise exception using errcode = 'PT401', message = 'KAQ_REAUTHENTICATION_REQUIRED';
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
