-- #58のprivate code-exchange claim。codeやtoken、暗号文を受け取らず、network処理も行わない。
create function kaq_private.claim_exchange(
  p_intent_id uuid, p_intent_secret text, p_leg_id uuid, p_expected_leg_revision bigint
) returns jsonb language plpgsql volatile security definer
set search_path = pg_catalog, auth, kaq_private, extensions
as $$
declare
  context jsonb; intent kaq_private.account_intents%rowtype; leg kaq_private.account_proof_legs%rowtype;
  runtime kaq_private.account_proof_runtime%rowtype;
begin
  if p_leg_id is null or p_expected_leg_revision is null or p_expected_leg_revision < 0
    or p_expected_leg_revision > 9007199254740991 then
    raise exception using errcode = 'PT400', message = 'KAQ_EXCHANGE_ARGUMENT_INVALID';
  end if;
  context := kaq_private.intent_actor_gate();
  intent := kaq_private.intent_control_lock(p_intent_id,p_intent_secret);
  select * into leg from kaq_private.account_proof_legs where id=p_leg_id and intent_id=intent.id for update;
  if not found then raise exception using errcode = 'PT404', message = 'KAQ_LEG_NOT_FOUND'; end if;
  select * into runtime from kaq_private.account_proof_runtime where leg_id=leg.id for update;
  perform kaq_private.intent_recheck_actor(context);
  intent := kaq_private.intent_expire_locked(intent.id);
  if leg.state in ('exchanging','exchanged','proved') then
    return kaq_private.authorization_control_result(intent,leg,false,false);
  end if;
  if intent.state not in ('awaiting_source','awaiting_target') then
    return kaq_private.authorization_control_result(intent,leg,false,false);
  end if;
  if (intent.state='awaiting_source' and leg.side <> 'source')
    or (intent.state='awaiting_target' and leg.side <> 'target')
    or leg.state <> 'issued' or leg.revision <> p_expected_leg_revision or leg.revision >= 9007199254740991
    or leg.authorization_claim_id is null or leg.authorization_prepared_at is null
    or leg.authorization_runtime_revision is null
    or runtime.leg_id is null or runtime.phase <> 'leg'
    or runtime.revision <> leg.authorization_runtime_revision
    or runtime.expires_at is distinct from leg.expires_at
    or kaq_private.runtime_epoch_ms(clock_timestamp()) >= kaq_private.runtime_epoch_ms(intent.expires_at)
    or kaq_private.runtime_epoch_ms(clock_timestamp()) >= kaq_private.runtime_epoch_ms(leg.expires_at) then
    raise exception using errcode = 'PT409', message = 'KAQ_EXCHANGE_STALE';
  end if;
  update kaq_private.account_proof_legs set state='exchanging',revision=revision+1
    where id=leg.id and state='issued' and revision=p_expected_leg_revision returning * into leg;
  if not found then raise exception using errcode = 'PT409', message = 'KAQ_EXCHANGE_STALE'; end if;
  return kaq_private.authorization_control_result(intent,leg,true,false);
end $$;
revoke all on function kaq_private.claim_exchange(uuid,text,uuid,bigint)
  from public, anon, authenticated, service_role;

create function kaq_private.fail_leg(
  p_intent_id uuid, p_intent_secret text, p_leg_id uuid, p_claim_id uuid,
  p_expected_leg_revision bigint, p_exchange_unknown boolean
) returns jsonb language plpgsql volatile security definer
set search_path = pg_catalog, auth, kaq_private, extensions
as $$
declare context jsonb; intent kaq_private.account_intents%rowtype; leg kaq_private.account_proof_legs%rowtype;
begin
  if p_leg_id is null or p_claim_id is null or p_claim_id='00000000-0000-0000-0000-000000000000'::uuid
    or p_expected_leg_revision is null or p_expected_leg_revision < 0 or p_expected_leg_revision > 9007199254740991
    or p_exchange_unknown is null then
    raise exception using errcode = 'PT400', message = 'KAQ_EXCHANGE_ARGUMENT_INVALID';
  end if;
  context := kaq_private.intent_actor_gate();
  intent := kaq_private.intent_control_lock(p_intent_id,p_intent_secret);
  select * into leg from kaq_private.account_proof_legs where id=p_leg_id and intent_id=intent.id for update;
  if not found then raise exception using errcode = 'PT404', message = 'KAQ_LEG_NOT_FOUND'; end if;
  perform kaq_private.intent_recheck_actor(context);
  intent := kaq_private.intent_expire_locked(intent.id);
  if leg.authorization_claim_id is distinct from p_claim_id then
    raise exception using errcode = 'PT409', message = 'KAQ_EXCHANGE_STALE';
  end if;
  if leg.revision = p_expected_leg_revision + 1
    and ((leg.state='failed' and not p_exchange_unknown) or (leg.state='exchange_unknown' and p_exchange_unknown)) then
    return kaq_private.authorization_control_result(intent,leg,false,false);
  end if;
  if intent.state not in ('awaiting_source','awaiting_target') then
    return kaq_private.authorization_control_result(intent,leg,false,false);
  end if;
  if leg.revision <> p_expected_leg_revision or leg.revision >= 9007199254740991 then
    raise exception using errcode = 'PT409', message = 'KAQ_EXCHANGE_STALE';
  end if;
  if (intent.state='awaiting_source' and leg.side <> 'source')
    or (intent.state='awaiting_target' and leg.side <> 'target') then
    raise exception using errcode = 'PT409', message = 'KAQ_EXCHANGE_STALE';
  end if;
  if (leg.state='issued' and not p_exchange_unknown) or (leg.state='exchanging' and not p_exchange_unknown) then
    update kaq_private.account_proof_legs set state='failed',revision=revision+1 where id=leg.id and revision=p_expected_leg_revision returning * into leg;
  elsif leg.state='exchanging' and p_exchange_unknown then
    update kaq_private.account_proof_legs set state='exchange_unknown',revision=revision+1 where id=leg.id and revision=p_expected_leg_revision returning * into leg;
  else
    raise exception using errcode = 'PT409', message = 'KAQ_EXCHANGE_STALE';
  end if;
  return kaq_private.authorization_control_result(intent,leg,false,false);
end $$;
revoke all on function kaq_private.fail_leg(uuid,text,uuid,uuid,bigint,boolean)
  from public, anon, authenticated, service_role;
