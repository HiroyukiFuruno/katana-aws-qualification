-- 各不正入力を独立したsubtransactionで拒否し、全保護rowの不変も照合する。
create function pg_temp.exchange_statement(op text,i uuid,s text,l uuid,c uuid,v bigint,r bigint default 0,u boolean default false)
returns text language plpgsql as $$
begin
  if op='claim' then return format('select kaq_private.claim_authorization(%L,%L,%L,%L,%L,decode(%L,''hex''))',i,s,l,v,r,repeat('22',32));
  elsif op='complete' then return format('select kaq_private.complete_authorization(%L,%L,%L,%L,%L,%L)',i,s,l,c,v,r);
  elsif op='exchange' then return format('select kaq_private.claim_exchange(%L,%L,%L,%L)',i,s,l,v);
  elsif op='fail' then return format('select kaq_private.fail_leg(%L,%L,%L,%L,%L,%L)',i,s,l,c,v,u);
  else raise exception 'unknown boundary operation'; end if;
end $$;

create function pg_temp.exchange_expect_state(label text,statement text,expected_state text,expected_constraint text default null)
returns void language plpgsql as $$
declare actual_state text; actual_constraint text;
begin
  begin execute statement; raise exception 'accepted invalid boundary: %',label;
  exception when others then
    get stacked diagnostics actual_state=returned_sqlstate,actual_constraint=constraint_name;
    if actual_state is distinct from expected_state or (expected_constraint is not null and actual_constraint is distinct from expected_constraint) then
      raise exception 'boundary % expected state % constraint %, got % %',label,expected_state,expected_constraint,actual_state,actual_constraint;
    end if;
  end;
  perform pg_temp.exchange_assert(label,true);
end $$;

do $$
declare
  x_uid uuid:='__FIRST_USER__'; x_sid uuid:='__FIRST_SESSION__'; x_intent uuid; x_leg uuid;
  x_other uuid:=gen_random_uuid(); x_claim uuid:=gen_random_uuid(); x_secret text:=repeat('a',64);
  x_guard jsonb; x_before jsonb; x_reply jsonb; x_op text; x_expected text; x_rev bigint;
begin
  perform pg_temp.exchange_actor(x_uid,x_sid);
  select i.id,l.id into strict x_intent,x_leg from kaq_private.account_intents i
    join kaq_private.account_proof_legs l on l.intent_id=i.id
    where i.actor_uid=x_uid and i.actor_session_id=x_sid and i.state='awaiting_source' and l.state='issued';
  update kaq_private.account_proof_legs set revision=0,authorization_claim_id=null,authorization_request_hash=null,
    authorization_prepared_at=null,authorization_runtime_revision=null where id=x_leg;
  update kaq_private.account_proof_runtime set phase='leg',revision=0,
    expires_at=(select expires_at from kaq_private.account_proof_legs where id=x_leg) where leg_id=x_leg;
  select kaq_private.leg_control_result(i,l)->'guard' into x_guard
    from kaq_private.account_intents i join kaq_private.account_proof_legs l on l.intent_id=i.id where l.id=x_leg;

  -- 型/NULL/overflowは有効なowner fixtureで、他の拒否条件と混同しない。
  x_before:=pg_temp.exchange_snapshot();
  foreach x_op in array array['claim','complete','exchange','fail'] loop
    x_expected:=case when x_op in ('claim','complete') then 'KAQ_AUTHORIZATION_ARGUMENT_INVALID' else 'KAQ_EXCHANGE_ARGUMENT_INVALID' end;
    perform pg_temp.exchange_expect('b_null_revision_'||x_op,pg_temp.exchange_statement(x_op,x_intent,x_secret,x_leg,x_claim,null),x_expected);
    perform pg_temp.exchange_expect('b_overflow_argument_'||x_op,pg_temp.exchange_statement(x_op,x_intent,x_secret,x_leg,x_claim,9007199254740992),x_expected);
    perform pg_temp.exchange_expect('b_null_intent_'||x_op,pg_temp.exchange_statement(x_op,null,x_secret,x_leg,x_claim,0),'KAQ_INTENT_NOT_FOUND');
    perform pg_temp.exchange_expect('b_null_secret_'||x_op,pg_temp.exchange_statement(x_op,x_intent,null,x_leg,x_claim,0),'KAQ_INTENT_NOT_FOUND');
    perform pg_temp.exchange_expect('b_missing_leg_'||x_op,pg_temp.exchange_statement(x_op,x_intent,x_secret,gen_random_uuid(),x_claim,0),'KAQ_LEG_NOT_FOUND');
  end loop;
  perform pg_temp.exchange_expect('b_null_complete_claim',pg_temp.exchange_statement('complete',x_intent,x_secret,x_leg,null,0),'KAQ_AUTHORIZATION_ARGUMENT_INVALID');
  perform pg_temp.exchange_expect('b_null_failure_kind',pg_temp.exchange_statement('fail',x_intent,x_secret,x_leg,x_claim,0,0,null),'KAQ_EXCHANGE_ARGUMENT_INVALID');
  perform pg_temp.exchange_expect_state('b_invalid_numeric_type',format('select kaq_private.claim_exchange(%L,%L,%L,''not-an-integer'')',x_intent,x_secret,x_leg),'22P02');
  perform pg_temp.exchange_assert('b_argument_group_zero_change',x_before=pg_temp.exchange_snapshot());

  delete from kaq_private.account_proof_runtime where leg_id=x_leg;
  x_before:=pg_temp.exchange_snapshot();
  perform pg_temp.exchange_expect('b_missing_runtime_claim',pg_temp.exchange_statement('claim',x_intent,x_secret,x_leg,null,0),'KAQ_AUTHORIZATION_STALE');
  perform pg_temp.exchange_assert('b_missing_runtime_claim_zero',x_before=pg_temp.exchange_snapshot());
  perform pg_temp.exchange_assert('b_restore_runtime',kaq_private.runtime_compare_and_swap(x_leg,null,
    jsonb_build_object('revision',0,'keyVersion','v1','nonce',repeat('ab',12),'ciphertext',repeat('cd',16),'expiresAt',x_guard->'expiresAt'),x_guard));

  update kaq_private.account_proof_runtime set phase='proof' where leg_id=x_leg;
  x_before:=pg_temp.exchange_snapshot();
  perform pg_temp.exchange_expect('b_wrong_runtime_phase_claim',pg_temp.exchange_statement('claim',x_intent,x_secret,x_leg,null,0),'KAQ_AUTHORIZATION_STALE');
  perform pg_temp.exchange_assert('b_wrong_runtime_phase_claim_zero',x_before=pg_temp.exchange_snapshot());
  update kaq_private.account_proof_runtime set phase='leg' where leg_id=x_leg;
  update kaq_private.account_proof_legs set side='target' where id=x_leg;
  x_before:=pg_temp.exchange_snapshot();
  perform pg_temp.exchange_expect('b_wrong_side_claim',pg_temp.exchange_statement('claim',x_intent,x_secret,x_leg,null,0),'KAQ_AUTHORIZATION_STALE');
  perform pg_temp.exchange_assert('b_wrong_side_claim_zero',x_before=pg_temp.exchange_snapshot());
  update kaq_private.account_proof_legs set side='source' where id=x_leg;
  insert into kaq_private.account_intents(id,kind,actor_uid,actor_session_id,secret_hash,state,expires_at)
    values(x_other,'add_existing',x_uid,x_sid,extensions.digest(decode(x_secret,'hex'),'sha256'),'cancelled',clock_timestamp()+interval '9 minutes');
  x_before:=pg_temp.exchange_snapshot();
  perform pg_temp.exchange_expect('b_leg_intent_mismatch',pg_temp.exchange_statement('claim',x_other,x_secret,x_leg,null,0),'KAQ_LEG_NOT_FOUND');
  perform pg_temp.exchange_assert('b_leg_intent_mismatch_zero',x_before=pg_temp.exchange_snapshot());

  x_reply:=kaq_private.claim_authorization(x_intent,x_secret,x_leg,0,0,decode(repeat('22',32),'hex'));
  x_claim:=(x_reply->>'claim_id')::uuid;
  x_before:=pg_temp.exchange_snapshot();
  perform pg_temp.exchange_expect('b_unprepared_exchange',pg_temp.exchange_statement('exchange',x_intent,x_secret,x_leg,null,1),'KAQ_EXCHANGE_STALE');
  perform pg_temp.exchange_assert('b_unprepared_exchange_zero',x_before=pg_temp.exchange_snapshot());
  update kaq_private.account_proof_legs set side='target' where id=x_leg;
  x_before:=pg_temp.exchange_snapshot();
  perform pg_temp.exchange_expect('b_wrong_side_complete',pg_temp.exchange_statement('complete',x_intent,x_secret,x_leg,x_claim,1),'KAQ_AUTHORIZATION_STALE');
  perform pg_temp.exchange_expect('b_wrong_side_failure',pg_temp.exchange_statement('fail',x_intent,x_secret,x_leg,x_claim,1),'KAQ_EXCHANGE_STALE');
  perform pg_temp.exchange_assert('b_wrong_side_complete_zero',x_before=pg_temp.exchange_snapshot());
  update kaq_private.account_proof_legs set side='source',revision=9007199254740991 where id=x_leg;
  x_before:=pg_temp.exchange_snapshot();
  perform pg_temp.exchange_expect('b_max_complete',pg_temp.exchange_statement('complete',x_intent,x_secret,x_leg,x_claim,9007199254740991),'KAQ_AUTHORIZATION_STALE');
  perform pg_temp.exchange_expect('b_max_failure',pg_temp.exchange_statement('fail',x_intent,x_secret,x_leg,x_claim,9007199254740991),'KAQ_EXCHANGE_STALE');
  perform pg_temp.exchange_assert('b_max_complete_failure_zero',x_before=pg_temp.exchange_snapshot());
  update kaq_private.account_proof_legs set revision=1 where id=x_leg;

  x_before:=pg_temp.exchange_snapshot();
  perform pg_temp.exchange_expect_state('b_prepared_before_issued',format('update kaq_private.account_proof_legs set authorization_prepared_at=issued_at-interval ''1 millisecond'',authorization_runtime_revision=0 where id=%L',x_leg),'23514','account_proof_legs_authorization_prepared_time');
  perform pg_temp.exchange_expect_state('b_prepared_at_expiry',format('update kaq_private.account_proof_legs set authorization_prepared_at=expires_at,authorization_runtime_revision=0 where id=%L',x_leg),'23514','account_proof_legs_authorization_prepared_time');
  perform pg_temp.exchange_expect_state('b_claim_pair',format('update kaq_private.account_proof_legs set authorization_claim_id=null where id=%L',x_leg),'23514','account_proof_legs_authorization_claim_pair');
  perform pg_temp.exchange_expect_state('b_hash_length',format('update kaq_private.account_proof_legs set authorization_request_hash=decode(''01'',''hex'') where id=%L',x_leg),'23514','account_proof_legs_authorization_request_hash_length');
  perform pg_temp.exchange_expect_state('b_prepared_pair',format('update kaq_private.account_proof_legs set authorization_prepared_at=issued_at+interval ''1 millisecond'' where id=%L',x_leg),'23514','account_proof_legs_authorization_prepared_pair');
  perform pg_temp.exchange_expect_state('b_prepared_claim_required',format('update kaq_private.account_proof_legs set authorization_claim_id=null,authorization_request_hash=null,authorization_prepared_at=issued_at+interval ''1 millisecond'',authorization_runtime_revision=0 where id=%L',x_leg),'23514','account_proof_legs_authorization_prepared_claim');
  perform pg_temp.exchange_expect_state('b_prepared_revision_safe',format('update kaq_private.account_proof_legs set authorization_prepared_at=issued_at+interval ''1 millisecond'',authorization_runtime_revision=9007199254740992 where id=%L',x_leg),'23514','account_proof_legs_authorization_runtime_revision_safe');
  perform pg_temp.exchange_assert('b_constraint_group_zero_change',x_before=pg_temp.exchange_snapshot());

  perform kaq_private.complete_authorization(x_intent,x_secret,x_leg,x_claim,1,0);
  update kaq_private.account_proof_legs set side='target' where id=x_leg;
  x_before:=pg_temp.exchange_snapshot();
  perform pg_temp.exchange_expect('b_wrong_side_exchange',pg_temp.exchange_statement('exchange',x_intent,x_secret,x_leg,null,2),'KAQ_EXCHANGE_STALE');
  perform pg_temp.exchange_assert('b_wrong_side_exchange_zero',x_before=pg_temp.exchange_snapshot());
  update kaq_private.account_proof_legs set side='source',revision=9007199254740991 where id=x_leg;
  x_before:=pg_temp.exchange_snapshot();
  perform pg_temp.exchange_expect('b_max_exchange',pg_temp.exchange_statement('exchange',x_intent,x_secret,x_leg,null,9007199254740991),'KAQ_EXCHANGE_STALE');
  perform pg_temp.exchange_assert('b_max_exchange_zero',x_before=pg_temp.exchange_snapshot());
  update kaq_private.account_proof_legs set revision=2 where id=x_leg;
  update kaq_private.account_proof_runtime set phase='proof' where leg_id=x_leg;
  x_before:=pg_temp.exchange_snapshot();
  perform pg_temp.exchange_expect('b_wrong_runtime_phase_exchange',pg_temp.exchange_statement('exchange',x_intent,x_secret,x_leg,null,2),'KAQ_EXCHANGE_STALE');
  perform pg_temp.exchange_assert('b_wrong_runtime_phase_exchange_zero',x_before=pg_temp.exchange_snapshot());
  update kaq_private.account_proof_runtime set phase='leg',revision=1 where leg_id=x_leg;
  x_before:=pg_temp.exchange_snapshot();
  perform pg_temp.exchange_expect('b_changed_prepared_runtime',pg_temp.exchange_statement('exchange',x_intent,x_secret,x_leg,null,2),'KAQ_EXCHANGE_STALE');
  perform pg_temp.exchange_assert('b_changed_prepared_runtime_zero',x_before=pg_temp.exchange_snapshot());
  update kaq_private.account_proof_runtime set revision=0 where leg_id=x_leg;
  perform kaq_private.claim_exchange(x_intent,x_secret,x_leg,2);
  x_reply:=kaq_private.fail_leg(x_intent,x_secret,x_leg,x_claim,3,false);
  perform pg_temp.exchange_assert('b_definite_failure',x_reply->>'leg_state'='failed');
  x_before:=pg_temp.exchange_snapshot();
  for x_rev in 1..3 loop
    x_reply:=kaq_private.fail_leg(x_intent,x_secret,x_leg,x_claim,3,false);
    perform pg_temp.exchange_assert('b_failure_replay_'||x_rev,x_reply->>'leg_state'='failed' and x_before=pg_temp.exchange_snapshot());
  end loop;
  perform pg_temp.exchange_expect('b_failure_kind_mismatch',pg_temp.exchange_statement('fail',x_intent,x_secret,x_leg,x_claim,3,0,true),'KAQ_EXCHANGE_STALE');
  perform pg_temp.exchange_assert('b_failure_kind_mismatch_zero',x_before=pg_temp.exchange_snapshot());
end $$;
select jsonb_build_object('status','passed','checks',(select count(*) from exchange_checks),'names',(select jsonb_agg(name order by name) from exchange_checks));
rollback;
