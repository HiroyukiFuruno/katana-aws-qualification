-- #58 private prepare/replay/restart。公開transport、proof受理、runtime保存はこのsliceの対象外。
create function kaq_private.leg_control_result(
  intent kaq_private.account_intents, leg kaq_private.account_proof_legs
) returns jsonb language sql stable security definer set search_path = pg_catalog, kaq_private as $$
  select jsonb_build_object(
    'intent_id', intent.id, 'intent_state', intent.state, 'intent_revision', intent.revision,
    'leg_id', leg.id, 'leg_state', leg.state, 'leg_revision', leg.revision, 'side', leg.side,
      'attempt', leg.attempt, 'guard', jsonb_build_object('purpose',case when leg.state in ('exchanged','proved') then 'proof' else 'leg' end,
      'intentId', intent.id, 'legId', leg.id,
      'attempt', leg.attempt, 'storageKey', leg.storage_key,
      'issuedAt', kaq_private.runtime_epoch_ms(leg.issued_at),
      'expiresAt', kaq_private.runtime_epoch_ms(case when leg.state in ('exchanged','proved') then intent.expires_at else leg.expires_at end)
    )
  )
$$;
revoke all on function kaq_private.leg_control_result(kaq_private.account_intents,kaq_private.account_proof_legs)
  from public, anon, authenticated, service_role;

create function kaq_private.issue_account_leg(
  p_intent_id uuid, p_intent_secret text, p_side text, p_expected_intent_revision bigint,
  p_idempotency_key uuid, p_nonce_hash bytea, p_replace_active boolean default false
) returns jsonb language plpgsql volatile security definer
set search_path = pg_catalog, auth, kaq_private, extensions
as $$
declare
  context jsonb; intent kaq_private.account_intents%rowtype; leg kaq_private.account_proof_legs%rowtype;
  replay kaq_private.account_proof_legs%rowtype; leg_id uuid; issued timestamptz; expires timestamptz;
  request_hash bytea; attempt_count integer;
begin
  if p_side is null or p_side not in ('source','target') or p_expected_intent_revision is null
    or p_expected_intent_revision < 0 or p_idempotency_key is null
    or p_idempotency_key = '00000000-0000-0000-0000-000000000000'::uuid
    or p_nonce_hash is null or octet_length(p_nonce_hash) <> 32 or p_replace_active is null then
    raise exception using errcode = 'PT400', message = 'KAQ_LEG_ARGUMENT_INVALID';
  end if;

  -- idempotency bodyには主sessionを束縛する。raw nonceはtable/result/logへ置かない。
  context := kaq_private.intent_actor_gate();
  intent := kaq_private.intent_control_lock(p_intent_id,p_intent_secret);
  request_hash := extensions.digest(jsonb_build_object('side',p_side,'expected_intent_revision',p_expected_intent_revision,
    'nonce_hash',encode(p_nonce_hash,'hex'),'replace_active',p_replace_active,
    'actor_session_id',context->>'session_id')::text,'sha256');

  -- 同sideを常にattempt順でlockする。行追加をintent row lockが直列化する。
  for leg in select * from kaq_private.account_proof_legs where intent_id=intent.id and side=p_side order by attempt for update loop
    if leg.state in ('issued','exchanging') and leg.expires_at <= clock_timestamp() then
      update kaq_private.account_proof_legs set state='failed', revision=revision+1 where id=leg.id returning * into leg;
    end if;
    if leg.prepare_idempotency_key = p_idempotency_key then replay := leg; end if;
  end loop;
  -- leg lock待機後にclaims/sessionを再検査する。ここからAuth/intentの新規lockは取らない。
  perform kaq_private.intent_recheck_actor(context);
  -- intent_control_lock直後だけではleg待機中のintent期限を見逃す。既存intent row lockを保持したまま再settleする。
  intent := kaq_private.intent_expire_locked(intent.id);

  if replay.id is not null then
    if replay.prepare_request_hash is distinct from request_hash then
      raise exception using errcode = 'PT409', message = 'KAQ_LEG_IDEMPOTENCY_CONFLICT';
    end if;
    select * into strict intent from kaq_private.account_intents where id=intent.id;
    return kaq_private.leg_control_result(intent,replay);
  end if;
  if intent.state not in ('awaiting_source','awaiting_target') then
    return jsonb_build_object('intent_id',intent.id,'intent_state',intent.state,'intent_revision',intent.revision,'side',p_side);
  end if;
  if (p_side='source' and intent.state <> 'awaiting_source')
    or (p_side='target' and intent.state <> 'awaiting_target') then
    raise exception using errcode = 'PT409', message = 'KAQ_LEG_SIDE_STATE';
  end if;
  if intent.revision <> p_expected_intent_revision then
    raise exception using errcode = 'PT409', message = 'KAQ_LEG_STALE';
  end if;

  select * into leg from kaq_private.account_proof_legs where intent_id=intent.id and side=p_side
    and state in ('issued','exchanging','exchanged') order by attempt desc limit 1;
  if found and not p_replace_active then
    raise exception using errcode = 'PT409', message = 'KAQ_LEG_ACTIVE';
  end if;
  if found then
    update kaq_private.account_proof_legs set state='superseded', revision=revision+1
      where intent_id=intent.id and side=p_side and state in ('issued','exchanging','exchanged');
  end if;
  if exists(select 1 from kaq_private.account_proof_legs existing where existing.intent_id=intent.id
    and existing.side=p_side and existing.state='proved') then
    raise exception using errcode = 'PT409', message = 'KAQ_LEG_PROVED_STATE';
  end if;
  select count(*) into attempt_count from kaq_private.account_proof_legs where intent_id=intent.id and side=p_side;
  if attempt_count >= 3 then
    update kaq_private.account_intents set state='attempts_exhausted',revision=revision+1 where id=intent.id returning * into intent;
    return jsonb_build_object('intent_id',intent.id,'intent_state',intent.state,'intent_revision',intent.revision,
      'side',p_side,'attempts_exhausted',true);
  end if;

  issued := date_trunc('milliseconds',clock_timestamp());
  expires := date_trunc('milliseconds',least(intent.expires_at,issued + interval '3 minutes'));
  if expires <= issued then
    update kaq_private.account_intents set state='expired',revision=revision+1 where id=intent.id returning * into intent;
    return jsonb_build_object('intent_id',intent.id,'intent_state',intent.state,'intent_revision',intent.revision);
  end if;
  leg_id := gen_random_uuid();
  insert into kaq_private.account_proof_legs(id,intent_id,side,attempt,expected_uid,storage_key,ingest_nonce_hash,
    issued_at,expires_at,prepare_idempotency_key,prepare_request_hash)
    values(leg_id,intent.id,p_side,attempt_count+1,case when p_side='source' then intent.actor_uid else null end,
      'kaq-proof:'||intent.id||':'||leg_id||':'||(attempt_count+1),p_nonce_hash,issued,expires,p_idempotency_key,request_hash)
    returning * into leg;
  update kaq_private.account_intents set revision=revision+1 where id=intent.id returning * into intent;
  return kaq_private.leg_control_result(intent,leg);
end $$;
revoke all on function kaq_private.issue_account_leg(uuid,text,text,bigint,uuid,bytea,boolean)
  from public, anon, authenticated, service_role;
