create function kaq_private.proof_claim_context() returns jsonb
language plpgsql volatile security definer
set search_path = pg_catalog, kaq_private
as $$
declare
  claims jsonb; configured_issuer text; subject_uuid uuid; session_uuid uuid; expires_at bigint;
  audience_valid boolean := false;
begin
  select auth_issuer into configured_issuer from kaq_private.account_protocol_settings where id;
  if not found or configured_issuer !~ '^https?://[^[:space:]]+$' then
    raise exception using errcode = '28000', message = 'KAQ_PROOF_AUTH_CONTEXT_INVALID';
  end if;
  begin
    claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
    if jsonb_typeof(claims) is distinct from 'object'
      or jsonb_typeof(claims->'sub') is distinct from 'string'
      or jsonb_typeof(claims->'session_id') is distinct from 'string'
      or jsonb_typeof(claims->'iss') is distinct from 'string'
      or claims->>'iss' is distinct from configured_issuer
      or claims->>'role' is distinct from 'authenticated'
      or jsonb_typeof(claims->'exp') is distinct from 'number'
      or claims->>'exp' !~ '^[0-9]+$' then
      raise exception using errcode = '28000', message = 'KAQ_PROOF_AUTH_CONTEXT_INVALID';
    end if;
    case jsonb_typeof(claims->'aud')
      when 'string' then audience_valid := claims->>'aud' = 'authenticated';
      when 'array' then audience_valid := claims->'aud' = '["authenticated"]'::jsonb;
      else audience_valid := false;
    end case;
    subject_uuid := (claims->>'sub')::uuid;
    session_uuid := (claims->>'session_id')::uuid;
    expires_at := (claims->>'exp')::bigint;
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception using errcode = '28000', message = 'KAQ_PROOF_AUTH_CONTEXT_INVALID';
  end;
  if subject_uuid = '00000000-0000-0000-0000-000000000000'::uuid
    or session_uuid = '00000000-0000-0000-0000-000000000000'::uuid
    or audience_valid is distinct from true or expires_at <= extract(epoch from clock_timestamp()) then
    raise exception using errcode = '28000', message = 'KAQ_PROOF_AUTH_CONTEXT_INVALID';
  end if;
  return jsonb_build_object('uid', subject_uuid, 'session_id', session_uuid);
end $$;
revoke all on function kaq_private.proof_claim_context() from public, anon, authenticated, service_role;

create function kaq_private.proof_accept_result(
  intent kaq_private.account_intents, leg kaq_private.account_proof_legs, proof kaq_private.account_proofs
) returns jsonb language sql stable security definer set search_path = pg_catalog, kaq_private as $$
  select jsonb_build_object('intent_id', intent.id, 'intent_state', intent.state,
    'intent_revision', intent.revision, 'leg_id', leg.id, 'leg_state', leg.state,
    'leg_revision', leg.revision, 'side', leg.side, 'expires_at', kaq_private.runtime_epoch_ms(intent.expires_at), 'proof_id', proof.id)
$$;
revoke all on function kaq_private.proof_accept_result(kaq_private.account_intents,kaq_private.account_proof_legs,kaq_private.account_proofs)
  from public, anon, authenticated, service_role;

create function kaq_private.accept_account_proof(
  p_intent_id uuid, p_leg_id uuid, p_ingest_nonce bytea, p_expected_leg_revision bigint
) returns jsonb language plpgsql volatile security definer
set search_path = pg_catalog, auth, kaq_private, extensions
as $$
declare
  initial_context jsonb; final_context jsonb; intent kaq_private.account_intents%rowtype;
  leg kaq_private.account_proof_legs%rowtype; proof kaq_private.account_proofs%rowtype;
  source_proof kaq_private.account_proofs%rowtype; source_leg kaq_private.account_proof_legs%rowtype;
  proof_uid uuid; proof_session_id uuid; source_member kaq_private.learning_memberships%rowtype;
  proof_member kaq_private.learning_memberships%rowtype; source_account kaq_private.learning_accounts%rowtype;
  proof_account kaq_private.learning_accounts%rowtype; proof_session auth.sessions%rowtype;
  source_session auth.sessions%rowtype; main_session auth.sessions%rowtype;
  proof_oauth_at timestamptz; source_oauth_at timestamptz; locked_users uuid[]; locked_accounts uuid[]; locked_sessions uuid[];
  initial_source_member jsonb; initial_proof_member jsonb; initial_source_account jsonb; initial_proof_account jsonb;
  item uuid; locked_count bigint; target_is_unassigned boolean := false; proof_is_unassigned boolean := false;
begin
  if p_intent_id is null or p_leg_id is null or p_ingest_nonce is null or octet_length(p_ingest_nonce) <> 32
    or p_expected_leg_revision is null or p_expected_leg_revision < 0
    or p_expected_leg_revision > 9007199254740991 then
    raise exception using errcode = 'PT400', message = 'KAQ_PROOF_ARGUMENT_INVALID';
  end if;
  initial_context := kaq_private.proof_claim_context();
  proof_uid := (initial_context->>'uid')::uuid;
  proof_session_id := (initial_context->>'session_id')::uuid;

  -- 安定したactor keyだけを先読みし、actor advisory lockの前に下位lockを取らない。
  select actor_uid into intent.actor_uid from kaq_private.account_intents where id = p_intent_id;
  if not found then raise exception using errcode = 'PT404', message = 'KAQ_PROOF_NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtextextended('kaq.account-intent.actor:' || intent.actor_uid, 581121));
  select * into intent from kaq_private.account_intents where id = p_intent_id for update;
  select * into leg from kaq_private.account_proof_legs where id = p_leg_id and intent_id = intent.id for update;
  if not found then raise exception using errcode = 'PT404', message = 'KAQ_PROOF_NOT_FOUND'; end if;
  if extensions.digest(p_ingest_nonce, 'sha256') is distinct from leg.ingest_nonce_hash then
    raise exception using errcode = 'PT403', message = 'KAQ_PROOF_NONCE_INVALID';
  end if;
  select p.* into source_proof from kaq_private.account_proofs p
    join kaq_private.account_proof_legs l on l.id = p.leg_id
    where p.intent_id = intent.id and l.side = 'source' for update of p, l;
  if source_proof.id is not null and source_proof.auth_uid is distinct from intent.actor_uid then
    raise exception using errcode = 'PT401', message = 'KAQ_PROOF_REAUTHENTICATION_REQUIRED';
  end if;

  -- 下位lockの前に、必要なAuth user集合を確定する。
  locked_users := array(select distinct value from unnest(array[intent.actor_uid, proof_uid]) value order by value);
  locked_sessions := array(select distinct value from unnest(array[intent.actor_session_id, proof_session_id, source_proof.session_id]) value
    where value is not null order by value);
  foreach item in array locked_users loop
    perform 1 from auth.users where id = item for share;
    if not found then raise exception using errcode = '28000', message = 'KAQ_SESSION_INVALID'; end if;
  end loop;
  foreach item in array locked_sessions loop
    begin
      perform 1 from auth.sessions where id = item for share nowait;
    exception when lock_not_available then
      raise exception using errcode = 'PT409', message = 'KAQ_SCOPE_RETRY';
    end;
    if not found then raise exception using errcode = '28000', message = 'KAQ_SESSION_INVALID'; end if;
  end loop;
  begin
    perform 1 from auth.mfa_amr_claims where session_id = any(locked_sessions)
      order by session_id, authentication_method for share nowait;
  exception when lock_not_available then
    raise exception using errcode = 'PT409', message = 'KAQ_SCOPE_RETRY';
  end;
  main_session := kaq_private.assert_live_session(intent.actor_uid, intent.actor_session_id, false);
  proof_session := kaq_private.assert_live_session(proof_uid, proof_session_id, false);
  if proof_session_id = intent.actor_session_id then
    raise exception using errcode = 'PT403', message = 'KAQ_PROOF_SESSION_REUSED';
  end if;
  if source_proof.id is not null then
    source_session := kaq_private.assert_live_session(source_proof.auth_uid, source_proof.session_id, false);
  end if;

  -- 所属snapshotを先読みし、state、account、当該二UIDのmembership順でlockして再照合する。
  select * into source_member from kaq_private.learning_memberships where auth_user_id = intent.actor_uid;
  initial_source_member := to_jsonb(source_member);
  select * into proof_member from kaq_private.learning_memberships where auth_user_id = proof_uid;
  initial_proof_member := to_jsonb(proof_member);
  select * into source_account from kaq_private.learning_accounts where id = source_member.account_id;
  initial_source_account := to_jsonb(source_account);
  select * into proof_account from kaq_private.learning_accounts where id = proof_member.account_id;
  initial_proof_account := to_jsonb(proof_account);
  select array_agg(distinct value order by value) into locked_accounts from unnest(array[source_member.account_id, proof_member.account_id]) value
    where value is not null;
  if locked_accounts is not null then
    perform 1 from public.learning_state where user_id = any(locked_accounts) order by user_id for update;
    get diagnostics locked_count = row_count;
    if locked_count <> cardinality(locked_accounts) then raise exception using errcode = 'PT409', message = 'KAQ_STATE_UNAVAILABLE'; end if;
    perform 1 from kaq_private.learning_accounts where id = any(locked_accounts) order by id for update;
    perform 1 from kaq_private.learning_memberships where auth_user_id in (intent.actor_uid, proof_uid)
      and account_id = any(locked_accounts) order by auth_user_id for update;
  end if;
  select * into source_member from kaq_private.learning_memberships where auth_user_id = intent.actor_uid;
  select * into proof_member from kaq_private.learning_memberships where auth_user_id = proof_uid;
  select * into source_account from kaq_private.learning_accounts where id = source_member.account_id;
  select * into proof_account from kaq_private.learning_accounts where id = proof_member.account_id;
  if to_jsonb(source_member) is distinct from initial_source_member
    or to_jsonb(proof_member) is distinct from initial_proof_member
    or to_jsonb(source_account) is distinct from initial_source_account
    or to_jsonb(proof_account) is distinct from initial_proof_account then
    raise exception using errcode = 'PT409', message = 'KAQ_SCOPE_RETRY';
  end if;
  if leg.side = 'source' and intent.kind = 'add_existing' then proof_is_unassigned := true; end if;
  if leg.side = 'target' and intent.kind = 'merge_existing' and proof_member.auth_user_id is null then
    target_is_unassigned := true; proof_is_unassigned := true;
  end if;

  final_context := kaq_private.proof_claim_context();
  if final_context is distinct from initial_context then raise exception using errcode = '28000', message = 'KAQ_PROOF_AUTH_CONTEXT_INVALID'; end if;
  intent := kaq_private.intent_expire_locked(intent.id);
  select * into leg from kaq_private.account_proof_legs where id = leg.id;
  select * into source_proof from kaq_private.account_proofs where leg_id = source_proof.leg_id;
  if source_proof.id is not null then
    select * into source_leg from kaq_private.account_proof_legs where id = source_proof.leg_id;
  end if;
  -- 上位Auth行は既に同一集合でlock済みなので、下位待機後はlive時刻だけを再検査する。
  main_session := kaq_private.assert_live_session(intent.actor_uid, intent.actor_session_id, false);
  proof_session := kaq_private.assert_live_session(proof_uid, proof_session_id, false);
  if source_proof.id is not null then
    source_session := kaq_private.assert_live_session(source_proof.auth_uid, source_proof.session_id, false);
  end if;

  if leg.state = 'proved' and leg.revision = p_expected_leg_revision + 1 then
    select * into proof from kaq_private.account_proofs where leg_id = leg.id;
    if not found or proof.auth_uid is distinct from proof_uid or proof.session_id is distinct from proof_session_id then
      raise exception using errcode = 'PT409', message = 'KAQ_PROOF_REPLAY_CONFLICT';
    end if;
    if intent.state in ('cancelled', 'expired', 'attempts_exhausted') then
      return kaq_private.proof_accept_result(intent, leg, proof);
    end if;
    if intent.state not in ('awaiting_target', 'both_proved', 'already_linked') then
      raise exception using errcode = 'PT409', message = 'KAQ_PROOF_STALE';
    end if;
    return kaq_private.proof_accept_result(intent, leg, proof);
  end if;
  if intent.state not in ('awaiting_source', 'awaiting_target') or leg.state <> 'exchanged'
    or leg.revision <> p_expected_leg_revision or leg.expires_at <= clock_timestamp()
    or intent.expires_at <= clock_timestamp() or leg.revision >= 9007199254740991
    or (intent.state = 'awaiting_source' and leg.side <> 'source')
    or (intent.state = 'awaiting_target' and leg.side <> 'target') then
    raise exception using errcode = 'PT409', message = 'KAQ_PROOF_STALE';
  end if;
  if proof_session.created_at < leg.issued_at then raise exception using errcode = 'PT401', message = 'KAQ_PROOF_REAUTHENTICATION_REQUIRED'; end if;
  select updated_at into proof_oauth_at from auth.mfa_amr_claims
    where session_id = proof_session_id and authentication_method = 'oauth' for share;
  if proof_oauth_at is null or not isfinite(proof_oauth_at) or proof_oauth_at < leg.issued_at
    or proof_oauth_at > clock_timestamp() + interval '5 seconds'
    or jsonb_typeof((current_setting('request.jwt.claims', true)::jsonb)->'amr') <> 'array' then
    raise exception using errcode = 'PT401', message = 'KAQ_PROOF_REAUTHENTICATION_REQUIRED';
  end if;
  if not exists(select 1 from jsonb_array_elements((current_setting('request.jwt.claims', true)::jsonb)->'amr') a
      where jsonb_typeof(a) = 'object' and a->>'method' = 'oauth' and jsonb_typeof(a->'timestamp') = 'number'
        and a->>'timestamp' ~ '^[0-9]+$' and (a->>'timestamp')::bigint = floor(extract(epoch from proof_oauth_at))::bigint) then
    raise exception using errcode = 'PT401', message = 'KAQ_PROOF_REAUTHENTICATION_REQUIRED';
  end if;
  if leg.side = 'source' then
    if proof_uid is distinct from intent.actor_uid or leg.expected_uid is distinct from intent.actor_uid then
      raise exception using errcode = 'PT403', message = 'KAQ_PROOF_SUBJECT_INVALID';
    end if;
    if intent.kind = 'merge_existing' then
      if source_member.auth_user_id is null or source_member.status <> 'active' or source_account.status <> 'active'
        or source_member.account_id is distinct from intent.source_account_id or source_member.epoch is distinct from intent.source_membership_epoch then
        raise exception using errcode = 'PT401', message = 'KAQ_PROOF_REAUTHENTICATION_REQUIRED';
      end if;
    elsif source_member.auth_user_id is not null or intent.source_account_id is not null or intent.source_membership_epoch is not null then
      raise exception using errcode = 'PT401', message = 'KAQ_PROOF_REAUTHENTICATION_REQUIRED';
    end if;
  else
    if proof_uid = intent.actor_uid then raise exception using errcode = 'PT403', message = 'KAQ_PROOF_SUBJECT_INVALID'; end if;
    if source_proof.id is null or source_leg.id is null or source_proof.auth_uid is distinct from intent.actor_uid
      or source_proof.expires_at <= clock_timestamp() or source_session.created_at is distinct from source_proof.session_created_at
      or source_session.created_at < source_leg.issued_at or source_proof.oauth_at < source_leg.issued_at then
      raise exception using errcode = 'PT401', message = 'KAQ_PROOF_REAUTHENTICATION_REQUIRED';
    end if;
    select updated_at into source_oauth_at from auth.mfa_amr_claims
      where session_id = source_proof.session_id and authentication_method = 'oauth' for share;
    if source_oauth_at is distinct from source_proof.oauth_at or source_oauth_at > clock_timestamp() + interval '5 seconds' then
      raise exception using errcode = 'PT401', message = 'KAQ_PROOF_REAUTHENTICATION_REQUIRED';
    end if;
    if intent.kind = 'merge_existing' then
      if source_member.auth_user_id is null or source_member.status <> 'active' or source_account.status <> 'active'
        or source_member.account_id is distinct from source_proof.account_id or source_member.epoch is distinct from source_proof.membership_epoch
        or source_account.membership_revision is distinct from source_proof.account_membership_revision then
        raise exception using errcode = 'PT401', message = 'KAQ_PROOF_REAUTHENTICATION_REQUIRED';
      end if;
    elsif source_member.auth_user_id is not null or source_proof.account_id is not null
      or source_proof.membership_epoch is not null or source_proof.account_membership_revision is not null then
      raise exception using errcode = 'PT401', message = 'KAQ_PROOF_REAUTHENTICATION_REQUIRED';
    end if;
    if not target_is_unassigned and (proof_member.auth_user_id is null or proof_member.status <> 'active' or proof_account.status <> 'active') then
      raise exception using errcode = 'PT403', message = 'KAQ_ACCOUNT_DISABLED';
    end if;
  end if;
  insert into kaq_private.account_proofs(intent_id, leg_id, auth_uid, session_id, session_created_at, oauth_at,
    account_id, membership_epoch, account_membership_revision, expires_at)
    values(intent.id, leg.id, proof_uid, proof_session_id, proof_session.created_at, proof_oauth_at,
      case when proof_is_unassigned then null else proof_member.account_id end,
      case when proof_is_unassigned then null else proof_member.epoch end,
      case when proof_is_unassigned then null else proof_account.membership_revision end, intent.expires_at)
    returning * into proof;
  update kaq_private.account_proof_legs set state = 'proved', revision = revision + 1 where id = leg.id returning * into leg;
  if leg.side = 'source' then
    update kaq_private.account_intents set state = 'awaiting_target', revision = revision + 1 where id = intent.id returning * into intent;
  else
    update kaq_private.account_intents set target_uid = proof_uid,
      target_account_id = case when target_is_unassigned then null else proof_member.account_id end,
      target_membership_epoch = case when target_is_unassigned then null else proof_member.epoch end,
      state = case when not target_is_unassigned and proof_member.account_id = source_member.account_id then 'already_linked' else 'both_proved' end,
      revision = revision + 1 where id = intent.id returning * into intent;
  end if;
  return kaq_private.proof_accept_result(intent, leg, proof);
end $$;
revoke all on function kaq_private.accept_account_proof(uuid,uuid,bytea,bigint)
  from public, anon, authenticated, service_role;
