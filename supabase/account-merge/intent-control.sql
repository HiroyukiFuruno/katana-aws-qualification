-- #58 begin/status/cancelだけのowner-only下書き。署名/issuer/projectを検証したwrapperのGUCを正本にする。
-- controlと将来commitは既知intent→Authの順。actor advisoryをAuth lock後に取得するcallerも禁止する。
create function kaq_private.intent_actor_gate() returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog, auth, kaq_private, extensions
as $$
declare context jsonb;
begin
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception using errcode = 'PT400', message = 'KAQ_SCOPE_ISOLATION_UNSUPPORTED';
  end if;
  context := kaq_private.lock_request_context();
  -- UUIDのhash衝突は余計な直列化だけ。actor/session/secretの検査をこのlockの代用にしない。
  perform pg_advisory_xact_lock(hashtextextended('kaq.account-intent.actor:' || (context ->> 'actor_uid'), 581121));
  return context;
end $$;
revoke all on function kaq_private.intent_actor_gate() from public, anon, authenticated, service_role;

create function kaq_private.intent_recheck_actor(initial_context jsonb) returns void
language plpgsql volatile security definer set search_path = pg_catalog, auth, kaq_private, extensions
as $$
declare context jsonb;
begin
  context := kaq_private.lock_request_context();
  if context ->> 'actor_uid' is distinct from initial_context ->> 'actor_uid'
    or context ->> 'session_id' is distinct from initial_context ->> 'session_id' then
    raise exception using errcode = '28000', message = 'KAQ_AUTH_CONTEXT_INVALID';
  end if;
  perform kaq_private.assert_live_session((context ->> 'actor_uid')::uuid, (context ->> 'session_id')::uuid, false);
  -- user SHAREの待機中にJWTが切れるため、live row取得だけでなく待機後の署名済みcontextも再検査する。
  context := kaq_private.lock_request_context();
  if context ->> 'actor_uid' is distinct from initial_context ->> 'actor_uid'
    or context ->> 'session_id' is distinct from initial_context ->> 'session_id' then
    raise exception using errcode = '28000', message = 'KAQ_AUTH_CONTEXT_INVALID';
  end if;
end $$;
revoke all on function kaq_private.intent_recheck_actor(jsonb) from public, anon, authenticated, service_role;

create function kaq_private.intent_expire_locked(intent_id uuid) returns kaq_private.account_intents
language plpgsql volatile security definer set search_path = pg_catalog, auth, kaq_private, extensions
as $$
declare intent kaq_private.account_intents%rowtype;
begin
  -- callerがactor/secretを検証し同じrow lockを保持済みの場合だけ使う。期限を延長しない。
  update kaq_private.account_intents set state = 'expired', revision = revision + 1
    where id = intent_id and state in ('awaiting_source','awaiting_target','both_proved','previewed')
      and expires_at <= clock_timestamp() returning * into intent;
  if not found then select * into strict intent from kaq_private.account_intents where id = intent_id; end if;
  return intent;
end $$;
revoke all on function kaq_private.intent_expire_locked(uuid) from public, anon, authenticated, service_role;

create function kaq_private.intent_control_result(intent kaq_private.account_intents) returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog, auth, kaq_private, extensions
as $$
declare receipt_id uuid; source_attempts integer; target_attempts integer;
begin
  if intent.state in ('committed','already_linked') then
    select id into receipt_id from kaq_private.account_merge_receipts where intent_id = intent.id;
    if not found then
      raise exception using errcode = 'PT500', message = 'KAQ_INTENT_RECEIPT_MISSING';
    end if;
  end if;
  select count(*) filter(where side='source'), count(*) filter(where side='target')
    into source_attempts, target_attempts from kaq_private.account_proof_legs where intent_id = intent.id;
  return jsonb_strip_nulls(jsonb_build_object('id',intent.id,'state',intent.state,'version',intent.revision,
    'expires_at',intent.expires_at,'remaining_attempts',jsonb_build_object(
      'source',greatest(0,3-source_attempts),'target',greatest(0,3-target_attempts)), 'commit_receipt_id',receipt_id));
end $$;
revoke all on function kaq_private.intent_control_result(kaq_private.account_intents)
  from public, anon, authenticated, service_role;

create function kaq_private.intent_control_lock(intent_id uuid, intent_secret text) returns kaq_private.account_intents
language plpgsql volatile security definer set search_path = pg_catalog, auth, kaq_private, extensions
as $$
declare context jsonb; intent kaq_private.account_intents%rowtype;
begin
  context := kaq_private.intent_actor_gate();
  if intent_id is null or intent_secret is null or intent_secret !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = 'PT404', message = 'KAQ_INTENT_NOT_FOUND';
  end if;
  select * into intent from kaq_private.account_intents where id = intent_id
    and actor_uid = (context ->> 'actor_uid')::uuid and actor_session_id = (context ->> 'session_id')::uuid for update;
  if not found or intent.secret_hash is distinct from extensions.digest(decode(intent_secret,'hex'),'sha256') then
    raise exception using errcode = 'PT404', message = 'KAQ_INTENT_NOT_FOUND';
  end if;
  -- 間違ったsecret/actor/未知IDで期限やattemptを書き換えず、正しい提示だけで待機後liveを再検査する。
  perform kaq_private.intent_recheck_actor(context);
  return kaq_private.intent_expire_locked(intent.id);
end $$;
revoke all on function kaq_private.intent_control_lock(uuid,text) from public, anon, authenticated, service_role;

create function kaq_private.begin_account_intent(kind text, idempotency_key uuid, replace_active boolean default false)
returns jsonb language plpgsql volatile security definer
set search_path = pg_catalog, auth, kaq_private, extensions
as $$
declare
  context jsonb; v_actor_uid uuid; actor_session uuid; request_hash bytea;
  replay kaq_private.account_intents%rowtype; active_intent kaq_private.account_intents%rowtype;
  created_intent kaq_private.account_intents%rowtype; member kaq_private.learning_memberships%rowtype;
  scope jsonb; generation bigint; source_account uuid; source_epoch bigint;
  checked_at timestamptz; raw_secret bytea; secret text; starts bigint;
begin
  if kind is null or kind not in ('add_existing','merge_existing') or replace_active is null
    or idempotency_key is null or idempotency_key = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception using errcode = 'PT400', message = 'KAQ_INTENT_ARGUMENT_INVALID';
  end if;
  context := kaq_private.intent_actor_gate();
  v_actor_uid := (context ->> 'actor_uid')::uuid; actor_session := (context ->> 'session_id')::uuid;
  request_hash := extensions.digest(jsonb_build_object('kind',kind,'replace_active',replace_active,
    'actor_session_id',actor_session)::text,'sha256');
  select * into replay from kaq_private.account_intents existing
    where existing.actor_uid = v_actor_uid and existing.begin_idempotency_key = idempotency_key for update;
  if found then
    if replay.actor_session_id <> actor_session or replay.begin_request_hash is distinct from request_hash then
      raise exception using errcode = 'PT409', message = 'KAQ_INTENT_IDEMPOTENCY_CONFLICT';
    end if;
    perform kaq_private.intent_recheck_actor(context);
    replay := kaq_private.intent_expire_locked(replay.id);
    return kaq_private.intent_control_result(replay) || jsonb_build_object('secret_recoverable',false,'recovery_required',true,
      'restart_required_if_secret_lost',true);
  end if;
  select * into active_intent from kaq_private.account_intents existing where existing.actor_uid = v_actor_uid
    and existing.state in ('awaiting_source','awaiting_target','both_proved','previewed') for update;

  select * into member from kaq_private.learning_memberships where auth_user_id = v_actor_uid;
  if kind = 'add_existing' then
    if found then raise exception using errcode = 'PT409', message = 'KAQ_INTENT_SOURCE_STATE'; end if;
    perform kaq_private.intent_recheck_actor(context);
    if exists(select 1 from kaq_private.learning_memberships where auth_user_id = v_actor_uid) then
      raise exception using errcode = 'PT409', message = 'KAQ_INTENT_SOURCE_STATE';
    end if;
  else
    if not found then raise exception using errcode = 'PT409', message = 'KAQ_INTENT_SOURCE_STATE'; end if;
    select learning.generation into generation from public.learning_state learning where user_id = member.account_id;
    if not found then raise exception using errcode = 'PT500', message = 'KAQ_ACCOUNT_STATE_MISSING'; end if;
    -- actorだけを先取りしない。intent lock後に全対象UID順Auth→session→stateを既存helperで取得する。
    scope := kaq_private.lock_learning_scope('writer',generation);
    perform kaq_private.intent_recheck_actor(context);
    source_account := (scope ->> 'account_id')::uuid; source_epoch := (scope ->> 'membership_epoch')::bigint;
  end if;
  checked_at := clock_timestamp();
  if active_intent.id is not null then
    active_intent := kaq_private.intent_expire_locked(active_intent.id);
    if active_intent.state in ('awaiting_source','awaiting_target','both_proved','previewed')
      and (not replace_active or active_intent.actor_session_id <> actor_session) then
      raise exception using errcode = 'PT409', message = 'KAQ_INTENT_ACTIVE';
    end if;
  end if;
  select count(*) into starts from kaq_private.account_intents existing
    where existing.actor_uid = v_actor_uid and existing.created_at > checked_at - interval '15 minutes';
  if starts >= 5 then raise exception using errcode = 'PT429', message = 'KAQ_INTENT_RATE_LIMITED'; end if;
  if active_intent.id is not null and active_intent.state in ('awaiting_source','awaiting_target','both_proved','previewed') then
    update kaq_private.account_intents set state='cancelled', revision=revision+1 where id=active_intent.id;
  end if;
  raw_secret := extensions.gen_random_bytes(32); secret := encode(raw_secret,'hex');
  insert into kaq_private.account_intents(kind,actor_uid,actor_session_id,secret_hash,source_account_id,
    source_membership_epoch,created_at,expires_at,begin_idempotency_key,begin_request_hash)
    values(kind,v_actor_uid,actor_session,extensions.digest(raw_secret,'sha256'),source_account,source_epoch,
      checked_at,checked_at+interval '10 minutes',idempotency_key,request_hash) returning * into created_intent;
  return kaq_private.intent_control_result(created_intent) || jsonb_build_object('secret',secret,
    'secret_recoverable',false,'source_state',case kind when 'merge_existing' then 'ready' else 'onboarding_required' end);
end $$;
revoke all on function kaq_private.begin_account_intent(text,uuid,boolean)
  from public, anon, authenticated, service_role;

create function kaq_private.read_account_intent(intent_id uuid, intent_secret text) returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog, auth, kaq_private, extensions
as $$
declare intent kaq_private.account_intents%rowtype;
begin
  intent := kaq_private.intent_control_lock(intent_id,intent_secret);
  return kaq_private.intent_control_result(intent);
end $$;
revoke all on function kaq_private.read_account_intent(uuid,text) from public, anon, authenticated, service_role;

create function kaq_private.cancel_account_intent(intent_id uuid, intent_secret text, expected_version bigint) returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog, auth, kaq_private, extensions
as $$
declare intent kaq_private.account_intents%rowtype;
begin
  intent := kaq_private.intent_control_lock(intent_id,intent_secret);
  if expected_version is null or expected_version < 0 then
    raise exception using errcode = 'PT400', message = 'KAQ_INTENT_ARGUMENT_INVALID';
  end if;
  if intent.state in ('awaiting_source','awaiting_target','both_proved','previewed') then
    if intent.revision <> expected_version then
      raise exception using errcode = 'PT409', message = 'KAQ_INTENT_STALE';
    end if;
    update kaq_private.account_intents set state='cancelled',revision=revision+1
      where id=intent.id returning * into intent;
  end if;
  -- terminalは再openしない。commit先行なら既存receiptを返し、取消し成功と偽装しない。
  return kaq_private.intent_control_result(intent);
end $$;
revoke all on function kaq_private.cancel_account_intent(uuid,text,bigint) from public, anon, authenticated, service_role;

-- 未実装: Edge/body-only transport/log秘匿、leg/proof/secret blob cleanup、commit、公開wrapper/migration登録。
-- 全begin writerのactor advisory参加と、将来commitがintent→Auth順を維持することを統合時に確認する。
