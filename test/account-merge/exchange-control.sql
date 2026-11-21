begin;
create temporary table exchange_checks(name text primary key) on commit drop;
create function pg_temp.exchange_assert(label text, passed boolean) returns void language plpgsql as $$
begin if passed is distinct from true then raise exception 'exchange assertion failed: %',label; end if; insert into exchange_checks values(label); end $$;
create function pg_temp.exchange_expect(label text, statement text, expected text) returns void language plpgsql as $$
declare actual text;
begin
  begin execute statement; raise exception 'accepted invalid exchange input: %',label;
  exception when others then get stacked diagnostics actual=message_text;
    if actual <> expected then raise exception 'exchange % expected %, got %',label,expected,actual; end if;
  end;
  perform pg_temp.exchange_assert(label,true);
end $$;
create function pg_temp.exchange_actor(uid uuid,sid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'session_id',sid,'role','authenticated','aud','authenticated',
    'exp',floor(extract(epoch from clock_timestamp()))+3600)::text,true);
  perform set_config('request.headers','{}',true);
end $$;
create function pg_temp.exchange_snapshot() returns jsonb language sql as $$
  select exchange_harness.snapshot()
$$;
do $$
declare
  uid uuid:='__FIRST_USER__'; sid uuid:='__FIRST_SESSION__'; other_uid uuid:='__SECOND_USER__'; other_sid uuid:='__SECOND_SESSION__'; alternate_sid uuid:='__FIRST_ALT_SESSION__';
  intent_id uuid:=gen_random_uuid(); other_intent_id uuid:=gen_random_uuid(); secret text:=repeat('a',64); issued jsonb; claimed jsonb; prepared jsonb; exchanged jsonb; late jsonb;
  leg_id uuid; claim_id uuid; guard jsonb; proof_guard jsonb; before jsonb; after_claim jsonb; fn record; role_name text;
begin
  perform pg_temp.exchange_actor(uid,sid);
  insert into kaq_private.account_intents(id,kind,actor_uid,actor_session_id,secret_hash,expires_at)
    values(intent_id,'add_existing',uid,sid,extensions.digest(decode(secret,'hex'),'sha256'),clock_timestamp()+interval '9 minutes');
  insert into kaq_private.account_intents(id,kind,actor_uid,actor_session_id,secret_hash,expires_at)
    values(other_intent_id,'add_existing',other_uid,other_sid,extensions.digest(decode(secret,'hex'),'sha256'),clock_timestamp()+interval '9 minutes');
  issued:=kaq_private.issue_account_leg(intent_id,secret,'source',0,gen_random_uuid(),decode(repeat('11',32),'hex'));
  leg_id:=(issued->>'leg_id')::uuid; guard:=issued->'guard';
  perform pg_temp.exchange_assert('initial_runtime',kaq_private.runtime_compare_and_swap(leg_id,null,
    jsonb_build_object('revision',0,'keyVersion','v1','nonce',repeat('ab',12),'ciphertext',repeat('cd',16),'expiresAt',guard->'expiresAt'),guard));
  before:=pg_temp.exchange_snapshot();
  perform pg_temp.exchange_expect('null_claim_hash','select kaq_private.claim_authorization('||quote_literal(intent_id)||','||quote_literal(secret)||','||quote_literal(leg_id)||',1,0,null)','KAQ_AUTHORIZATION_ARGUMENT_INVALID');
  perform pg_temp.exchange_expect('bad_claim_runtime','select kaq_private.claim_authorization('||quote_literal(intent_id)||','||quote_literal(secret)||','||quote_literal(leg_id)||',1,9007199254740992,decode(repeat(''12'',32),''hex''))','KAQ_AUTHORIZATION_ARGUMENT_INVALID');
  perform pg_temp.exchange_assert('invalid_claim_zero_change',before=pg_temp.exchange_snapshot());
  perform pg_temp.exchange_actor(other_uid,other_sid);
  perform pg_temp.exchange_expect('wrong_actor','select kaq_private.claim_authorization('||quote_literal(intent_id)||','||quote_literal(secret)||','||quote_literal(leg_id)||',1,0,decode(repeat(''12'',32),''hex''))','KAQ_INTENT_NOT_FOUND');
  perform pg_temp.exchange_actor(uid,alternate_sid);
  perform pg_temp.exchange_expect('wrong_session','select kaq_private.claim_authorization('||quote_literal(intent_id)||','||quote_literal(secret)||','||quote_literal(leg_id)||',0,0,decode(repeat(''12'',32),''hex''))','KAQ_INTENT_NOT_FOUND');
  perform pg_temp.exchange_actor(uid,sid);
  perform pg_temp.exchange_expect('wrong_secret','select kaq_private.claim_authorization('||quote_literal(intent_id)||','||quote_literal(repeat('0',64))||','||quote_literal(leg_id)||',1,0,decode(repeat(''12'',32),''hex''))','KAQ_INTENT_NOT_FOUND');
  perform pg_temp.exchange_assert('ownership_zero_change',before=pg_temp.exchange_snapshot());
  claimed:=kaq_private.claim_authorization(intent_id,secret,leg_id,0,0,decode(repeat('12',32),'hex')); claim_id:=(claimed->>'claim_id')::uuid;
  perform pg_temp.exchange_assert('claim_once',claimed->>'claimed'='true' and claim_id is not null
    and (select authorization_claim_id=claim_id and octet_length(authorization_request_hash)=32 and revision=1 from kaq_private.account_proof_legs where id=leg_id));
  after_claim:=pg_temp.exchange_snapshot();
  perform pg_temp.exchange_assert('claim_nonexposure',not (claimed::text ~* '(nonce|hash|verifier|token|cipher|url|peer|uid)'));
  perform pg_temp.exchange_assert('same_claim_replay',kaq_private.claim_authorization(intent_id,secret,leg_id,0,0,decode(repeat('12',32),'hex'))->>'recovery_required'='true'
    and after_claim=pg_temp.exchange_snapshot());
  perform pg_temp.exchange_assert('same_claim_replay_two',kaq_private.claim_authorization(intent_id,secret,leg_id,0,0,decode(repeat('12',32),'hex'))->>'recovery_required'='true' and after_claim=pg_temp.exchange_snapshot());
  perform pg_temp.exchange_assert('same_claim_replay_three',kaq_private.claim_authorization(intent_id,secret,leg_id,0,0,decode(repeat('12',32),'hex'))->>'recovery_required'='true' and after_claim=pg_temp.exchange_snapshot());
  perform pg_temp.exchange_expect('exchange_before_prepared','select kaq_private.claim_exchange('||quote_literal(intent_id)||','||quote_literal(secret)||','||quote_literal(leg_id)||',1)','KAQ_EXCHANGE_STALE');
  perform pg_temp.exchange_assert('before_prepared_zero_change',after_claim=pg_temp.exchange_snapshot());
  perform pg_temp.exchange_expect('claim_different_hash','select kaq_private.claim_authorization('||quote_literal(intent_id)||','||quote_literal(secret)||','||quote_literal(leg_id)||',1,0,decode(repeat(''13'',32),''hex''))','KAQ_AUTHORIZATION_CLAIM_CONFLICT');
  perform pg_temp.exchange_assert('different_hash_zero_change',after_claim=pg_temp.exchange_snapshot());
  perform pg_temp.exchange_expect('complete_wrong_claim','select kaq_private.complete_authorization('||quote_literal(intent_id)||','||quote_literal(secret)||','||quote_literal(leg_id)||',gen_random_uuid(),1,0)','KAQ_AUTHORIZATION_CLAIM_STALE');
  prepared:=kaq_private.complete_authorization(intent_id,secret,leg_id,claim_id,1,0);
  perform pg_temp.exchange_assert('complete_fixed',prepared->>'authorization_prepared'='true' and (select authorization_prepared_at is not null and authorization_runtime_revision=0 and revision=2 from kaq_private.account_proof_legs where id=leg_id));
  before:=pg_temp.exchange_snapshot();
  perform pg_temp.exchange_assert('complete_replay_fixed',kaq_private.complete_authorization(intent_id,secret,leg_id,claim_id,1,0)=prepared and before=pg_temp.exchange_snapshot());
  perform pg_temp.exchange_assert('complete_replay_two',kaq_private.complete_authorization(intent_id,secret,leg_id,claim_id,1,0)=prepared and before=pg_temp.exchange_snapshot());
  perform pg_temp.exchange_assert('complete_replay_three',kaq_private.complete_authorization(intent_id,secret,leg_id,claim_id,1,0)=prepared and before=pg_temp.exchange_snapshot());
  perform pg_temp.exchange_expect('complete_wrong_prepared_runtime','select kaq_private.complete_authorization('||quote_literal(intent_id)||','||quote_literal(secret)||','||quote_literal(leg_id)||','||quote_literal(claim_id)||',1,1)','KAQ_AUTHORIZATION_STALE');
  perform pg_temp.exchange_expect('exchange_stale_revision','select kaq_private.claim_exchange('||quote_literal(intent_id)||','||quote_literal(secret)||','||quote_literal(leg_id)||',1)','KAQ_EXCHANGE_STALE');
  exchanged:=kaq_private.claim_exchange(intent_id,secret,leg_id,2);
  perform pg_temp.exchange_assert('exchange_once',exchanged->>'claimed'='true' and exchanged->>'leg_state'='exchanging'
    and (select revision=3 from kaq_private.account_proof_legs where id=leg_id));
  before:=pg_temp.exchange_snapshot();
  perform pg_temp.exchange_assert('exchange_replay',kaq_private.claim_exchange(intent_id,secret,leg_id,2)->>'claimed'='false' and before=pg_temp.exchange_snapshot());
  perform pg_temp.exchange_expect('unknown_only_exchanging','select kaq_private.fail_leg('||quote_literal(intent_id)||','||quote_literal(secret)||','||quote_literal(leg_id)||','||quote_literal(claim_id)||',2,true)','KAQ_EXCHANGE_STALE');
  perform pg_temp.exchange_assert('late_failure_guard',before=pg_temp.exchange_snapshot());
  exchanged:=kaq_private.fail_leg(intent_id,secret,leg_id,claim_id,3,true);
  perform pg_temp.exchange_assert('fail_exchange',exchanged->>'leg_state'='exchange_unknown'
    and (select revision=4 from kaq_private.account_proof_legs where id=leg_id));
  before:=pg_temp.exchange_snapshot();
  perform pg_temp.exchange_assert('fail_replay_one',kaq_private.fail_leg(intent_id,secret,leg_id,claim_id,3,true)->>'leg_state'='exchange_unknown' and before=pg_temp.exchange_snapshot());
  perform pg_temp.exchange_assert('fail_replay_two',kaq_private.fail_leg(intent_id,secret,leg_id,claim_id,3,true)->>'leg_state'='exchange_unknown' and before=pg_temp.exchange_snapshot());
  perform pg_temp.exchange_assert('fail_replay_three',kaq_private.fail_leg(intent_id,secret,leg_id,claim_id,3,true)->>'leg_state'='exchange_unknown' and before=pg_temp.exchange_snapshot());
  perform pg_temp.exchange_expect('fail_terminal','select kaq_private.fail_leg('||quote_literal(intent_id)||','||quote_literal(secret)||','||quote_literal(leg_id)||','||quote_literal(claim_id)||',4,false)','KAQ_EXCHANGE_STALE');
  late:=kaq_private.issue_account_leg(intent_id,secret,'source',1,gen_random_uuid(),decode(repeat('15',32),'hex'),true);
  leg_id:=(late->>'leg_id')::uuid; guard:=late->'guard';
  perform pg_temp.exchange_assert('late_runtime',kaq_private.runtime_compare_and_swap(leg_id,null,jsonb_build_object('revision',0,'keyVersion','v1','nonce',repeat('ab',12),'ciphertext',repeat('cd',16),'expiresAt',guard->'expiresAt'),guard));
  claimed:=kaq_private.claim_authorization(intent_id,secret,leg_id,0,0,decode(repeat('16',32),'hex')); claim_id:=(claimed->>'claim_id')::uuid;
  perform kaq_private.complete_authorization(intent_id,secret,leg_id,claim_id,1,0);
  perform kaq_private.claim_exchange(intent_id,secret,leg_id,2);
  proof_guard:=jsonb_set(guard,'{purpose}','"proof"'::jsonb) || jsonb_build_object('expiresAt',kaq_private.runtime_epoch_ms((select expires_at from kaq_private.account_intents where id=intent_id)));
  perform pg_temp.exchange_assert('proof_promotion',kaq_private.runtime_promote_proof(leg_id,3,guard,proof_guard,
    jsonb_build_object('revision',1,'keyVersion','v1','nonce',repeat('ef',12),'ciphertext',repeat('cd',16),'expiresAt',proof_guard->'expiresAt')));
  before:=pg_temp.exchange_snapshot();
  perform pg_temp.exchange_expect('late_failure_after_proof','select kaq_private.fail_leg('||quote_literal(intent_id)||','||quote_literal(secret)||','||quote_literal(leg_id)||','||quote_literal(claim_id)||',3,false)','KAQ_EXCHANGE_STALE');
  perform pg_temp.exchange_assert('late_failure_proof_preserved',before=pg_temp.exchange_snapshot());
  update kaq_private.account_proof_legs set state='issued',revision=0,authorization_claim_id=null,authorization_request_hash=null,authorization_prepared_at=null,authorization_runtime_revision=null where id=leg_id;
  update kaq_private.account_proof_runtime as test_runtime set revision=1 where test_runtime.leg_id=(late->>'leg_id')::uuid;
  before:=pg_temp.exchange_snapshot();
  perform pg_temp.exchange_expect('runtime_change_before_claim','select kaq_private.claim_authorization('||quote_literal(intent_id)||','||quote_literal(secret)||','||quote_literal(leg_id)||',0,0,decode(repeat(''14'',32),''hex''))','KAQ_AUTHORIZATION_STALE');
  perform pg_temp.exchange_assert('runtime_change_zero',before=pg_temp.exchange_snapshot());
  update kaq_private.account_proof_legs set revision=9007199254740991 where id=leg_id;
  before:=pg_temp.exchange_snapshot();
  perform pg_temp.exchange_expect('max_safe_no_increment','select kaq_private.claim_authorization('||quote_literal(intent_id)||','||quote_literal(secret)||','||quote_literal(leg_id)||',9007199254740991,1,decode(repeat(''17'',32),''hex''))','KAQ_AUTHORIZATION_STALE');
  perform pg_temp.exchange_assert('max_safe_zero_change',before=pg_temp.exchange_snapshot());
  perform pg_temp.exchange_assert('prepared_time_constraint',exists(select 1 from pg_constraint where conname='account_proof_legs_authorization_prepared_time'));
  foreach role_name in array array['anon','authenticated','service_role'] loop
    perform pg_temp.exchange_assert('claim_acl_'||role_name,not has_function_privilege(role_name,'kaq_private.claim_authorization(uuid,text,uuid,bigint,bigint,bytea)','EXECUTE'));
    perform pg_temp.exchange_assert('complete_acl_'||role_name,not has_function_privilege(role_name,'kaq_private.complete_authorization(uuid,text,uuid,uuid,bigint,bigint)','EXECUTE'));
    perform pg_temp.exchange_assert('exchange_acl_'||role_name,not has_function_privilege(role_name,'kaq_private.claim_exchange(uuid,text,uuid,bigint)','EXECUTE'));
    perform pg_temp.exchange_assert('fail_acl_'||role_name,not has_function_privilege(role_name,'kaq_private.fail_leg(uuid,text,uuid,uuid,bigint,boolean)','EXECUTE'));
  end loop;
  for fn in select * from pg_proc where oid in ('kaq_private.claim_authorization(uuid,text,uuid,bigint,bigint,bytea)'::regprocedure,
    'kaq_private.complete_authorization(uuid,text,uuid,uuid,bigint,bigint)'::regprocedure,'kaq_private.claim_exchange(uuid,text,uuid,bigint)'::regprocedure,
    'kaq_private.fail_leg(uuid,text,uuid,uuid,bigint,boolean)'::regprocedure) loop
    perform pg_temp.exchange_assert('definer_'||fn.proname,fn.prosecdef and fn.provolatile='v' and fn.proconfig @> array['search_path=pg_catalog, auth, kaq_private, extensions']);
  end loop;
  foreach role_name in array array['anon','authenticated','service_role'] loop
    perform pg_temp.exchange_assert('result_acl_'||role_name,not has_function_privilege(role_name,'kaq_private.authorization_control_result(kaq_private.account_intents,kaq_private.account_proof_legs,boolean,boolean)','EXECUTE'));
  end loop;
  select * into fn from pg_proc where oid='kaq_private.authorization_control_result(kaq_private.account_intents,kaq_private.account_proof_legs,boolean,boolean)'::regprocedure;
  perform pg_temp.exchange_assert('result_definer',fn.prosecdef and fn.provolatile='s' and fn.proconfig @> array['search_path=pg_catalog, kaq_private']);
end $$;
