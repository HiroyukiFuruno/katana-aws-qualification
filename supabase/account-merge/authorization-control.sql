-- #58のprivate authorization claim。provider URL、PKCE、nonce、tokenを扱わない。
create function kaq_private.authorization_control_result(
  intent kaq_private.account_intents, leg kaq_private.account_proof_legs,
  claimed boolean default false, recovery_required boolean default false
) returns jsonb language sql stable security definer set search_path = pg_catalog, kaq_private as $$
  select kaq_private.leg_control_result(intent,leg) || jsonb_strip_nulls(jsonb_build_object(
    'authorization_prepared', leg.authorization_prepared_at is not null,
    'claimed', claimed, 'recovery_required', recovery_required,
    'claim_id', case when claimed then leg.authorization_claim_id end
  ))
$$;
revoke all on function kaq_private.authorization_control_result(kaq_private.account_intents,kaq_private.account_proof_legs,boolean,boolean)
  from public, anon, authenticated, service_role;

create function kaq_private.claim_authorization(
  p_intent_id uuid, p_intent_secret text, p_leg_id uuid, p_expected_leg_revision bigint,
  p_expected_runtime_revision bigint, p_server_request_hash bytea
) returns jsonb language plpgsql volatile security definer
set search_path = pg_catalog, auth, kaq_private, extensions
as $$
declare
  context jsonb; intent kaq_private.account_intents%rowtype; leg kaq_private.account_proof_legs%rowtype;
  runtime kaq_private.account_proof_runtime%rowtype; claim_id uuid;
begin
  if p_leg_id is null or p_expected_leg_revision is null or p_expected_leg_revision < 0
    or p_expected_leg_revision > 9007199254740991 or p_expected_runtime_revision is null
    or p_expected_runtime_revision < 0 or p_expected_runtime_revision > 9007199254740991
    or p_server_request_hash is null or octet_length(p_server_request_hash) <> 32 then
    raise exception using errcode = 'PT400', message = 'KAQ_AUTHORIZATION_ARGUMENT_INVALID';
  end if;
  context := kaq_private.intent_actor_gate();
  intent := kaq_private.intent_control_lock(p_intent_id,p_intent_secret);
  select * into leg from kaq_private.account_proof_legs where id=p_leg_id and intent_id=intent.id for update;
  if not found then raise exception using errcode = 'PT404', message = 'KAQ_LEG_NOT_FOUND'; end if;
  select * into runtime from kaq_private.account_proof_runtime where leg_id=leg.id for update;
  perform kaq_private.intent_recheck_actor(context);
  intent := kaq_private.intent_expire_locked(intent.id);

  if leg.authorization_claim_id is not null then
    if leg.authorization_request_hash is distinct from p_server_request_hash then
      raise exception using errcode = 'PT409', message = 'KAQ_AUTHORIZATION_CLAIM_CONFLICT';
    end if;
    return kaq_private.authorization_control_result(intent,leg,false,true);
  end if;
  if intent.state not in ('awaiting_source','awaiting_target') then
    return kaq_private.authorization_control_result(intent,leg,false,false);
  end if;
  if (intent.state='awaiting_source' and leg.side <> 'source')
    or (intent.state='awaiting_target' and leg.side <> 'target')
    or leg.state <> 'issued' or leg.revision <> p_expected_leg_revision or leg.revision >= 9007199254740991
    or runtime.leg_id is null or runtime.phase <> 'leg' or runtime.revision <> p_expected_runtime_revision
    or runtime.expires_at is distinct from leg.expires_at
    or kaq_private.runtime_epoch_ms(clock_timestamp()) >= kaq_private.runtime_epoch_ms(intent.expires_at)
    or kaq_private.runtime_epoch_ms(clock_timestamp()) >= kaq_private.runtime_epoch_ms(leg.expires_at) then
    raise exception using errcode = 'PT409', message = 'KAQ_AUTHORIZATION_STALE';
  end if;
  claim_id := gen_random_uuid();
  update kaq_private.account_proof_legs set authorization_claim_id=claim_id,
    authorization_request_hash=p_server_request_hash, revision=revision+1 where id=leg.id returning * into leg;
  return kaq_private.authorization_control_result(intent,leg,true,false);
end $$;
revoke all on function kaq_private.claim_authorization(uuid,text,uuid,bigint,bigint,bytea)
  from public, anon, authenticated, service_role;

create function kaq_private.complete_authorization(
  p_intent_id uuid, p_intent_secret text, p_leg_id uuid, p_claim_id uuid,
  p_expected_leg_revision bigint, p_expected_runtime_revision bigint
) returns jsonb language plpgsql volatile security definer
set search_path = pg_catalog, auth, kaq_private, extensions
as $$
declare
  context jsonb; intent kaq_private.account_intents%rowtype; leg kaq_private.account_proof_legs%rowtype;
  runtime kaq_private.account_proof_runtime%rowtype; prepared_at timestamptz;
begin
  if p_leg_id is null or p_claim_id is null or p_claim_id='00000000-0000-0000-0000-000000000000'::uuid
    or p_expected_leg_revision is null or p_expected_leg_revision < 0 or p_expected_leg_revision > 9007199254740991
    or p_expected_runtime_revision is null or p_expected_runtime_revision < 0 or p_expected_runtime_revision > 9007199254740991 then
    raise exception using errcode = 'PT400', message = 'KAQ_AUTHORIZATION_ARGUMENT_INVALID';
  end if;
  context := kaq_private.intent_actor_gate();
  intent := kaq_private.intent_control_lock(p_intent_id,p_intent_secret);
  select * into leg from kaq_private.account_proof_legs where id=p_leg_id and intent_id=intent.id for update;
  if not found then raise exception using errcode = 'PT404', message = 'KAQ_LEG_NOT_FOUND'; end if;
  select * into runtime from kaq_private.account_proof_runtime where leg_id=leg.id for update;
  perform kaq_private.intent_recheck_actor(context);
  intent := kaq_private.intent_expire_locked(intent.id);
  if leg.authorization_claim_id is distinct from p_claim_id then
    raise exception using errcode = 'PT409', message = 'KAQ_AUTHORIZATION_CLAIM_STALE';
  end if;
  if leg.authorization_prepared_at is not null then
    if leg.authorization_runtime_revision is distinct from p_expected_runtime_revision then
      raise exception using errcode = 'PT409', message = 'KAQ_AUTHORIZATION_STALE';
    end if;
    return kaq_private.authorization_control_result(intent,leg,false,false);
  end if;
  if intent.state not in ('awaiting_source','awaiting_target') then
    return kaq_private.authorization_control_result(intent,leg,false,false);
  end if;
  if (intent.state='awaiting_source' and leg.side <> 'source')
    or (intent.state='awaiting_target' and leg.side <> 'target')
    or leg.state <> 'issued' or leg.revision <> p_expected_leg_revision or leg.revision >= 9007199254740991
    or runtime.leg_id is null or runtime.phase <> 'leg' or runtime.revision <> p_expected_runtime_revision
    or runtime.expires_at is distinct from leg.expires_at
    or kaq_private.runtime_epoch_ms(clock_timestamp()) >= kaq_private.runtime_epoch_ms(intent.expires_at)
    or kaq_private.runtime_epoch_ms(clock_timestamp()) >= kaq_private.runtime_epoch_ms(leg.expires_at) then
    raise exception using errcode = 'PT409', message = 'KAQ_AUTHORIZATION_STALE';
  end if;
  prepared_at := date_trunc('milliseconds',clock_timestamp());
  update kaq_private.account_proof_legs set authorization_prepared_at=prepared_at,
    authorization_runtime_revision=runtime.revision, revision=revision+1 where id=leg.id returning * into leg;
  return kaq_private.authorization_control_result(intent,leg,false,false);
end $$;
revoke all on function kaq_private.complete_authorization(uuid,text,uuid,uuid,bigint,bigint)
  from public, anon, authenticated, service_role;
