begin;
create temporary table leg_checks(name text primary key) on commit drop;
create function pg_temp.leg_assert(label text, passed boolean) returns void language plpgsql as $$
begin if passed is distinct from true then raise exception 'leg assertion failed: %',label; end if; insert into leg_checks values(label); end $$;
create function pg_temp.leg_expect(label text, statement text, expected text) returns void language plpgsql as $$
declare actual text;
begin
  begin execute statement; raise exception 'accepted invalid leg input: %',label;
  exception when others then get stacked diagnostics actual=message_text;
    if actual <> expected then raise exception 'leg % expected %, got %',label,expected,actual; end if;
  end;
  perform pg_temp.leg_assert(label,true);
end $$;
create function pg_temp.leg_actor(uid uuid,sid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'session_id',sid,'role','authenticated','aud','authenticated',
    'exp',floor(extract(epoch from clock_timestamp()))+3600)::text,true);
  perform set_config('request.headers','{}',true);
end $$;
create function pg_temp.leg_snapshot() returns jsonb language sql as $$
  select jsonb_build_object('intents',coalesce((select jsonb_agg(to_jsonb(i) order by i.id) from kaq_private.account_intents i),'[]'::jsonb),
    'legs',coalesce((select jsonb_agg(to_jsonb(l) order by l.id) from kaq_private.account_proof_legs l),'[]'::jsonb))
$$;
do $$
declare uid uuid:='__FIRST_USER__'; sid uuid:='__FIRST_SESSION__'; other_uid uuid:='__SECOND_USER__'; other_sid uuid:='__SECOND_SESSION__'; alternate_sid uuid:='__SECOND_ALT_SESSION__';
  intent_id uuid:=gen_random_uuid(); target_id uuid:=gen_random_uuid(); secret text:=repeat('a',64); value jsonb; replay jsonb;
  key uuid:=gen_random_uuid(); target_key uuid:=gen_random_uuid(); nonce bytea:=decode(repeat('12',32),'hex'); before jsonb; row_count integer; fn record; role_name text;
begin
  perform pg_temp.leg_actor(uid,sid);
  insert into kaq_private.account_intents(id,kind,actor_uid,actor_session_id,secret_hash,expires_at)
    values(intent_id,'add_existing',uid,sid,extensions.digest(decode(secret,'hex'),'sha256'),clock_timestamp()+interval '9 minutes');
  insert into kaq_private.account_intents(id,kind,actor_uid,actor_session_id,secret_hash,expires_at)
    values(target_id,'add_existing',other_uid,other_sid,extensions.digest(decode(secret,'hex'),'sha256'),clock_timestamp()+interval '9 minutes');
  perform pg_temp.leg_expect('null_nonce','select kaq_private.issue_account_leg('||quote_literal(intent_id)||','||quote_literal(secret)||',''source'',0,gen_random_uuid(),null)','KAQ_LEG_ARGUMENT_INVALID');
  perform pg_temp.leg_expect('bad_side','select kaq_private.issue_account_leg('||quote_literal(intent_id)||','||quote_literal(secret)||',''other'',0,gen_random_uuid(),decode(repeat(''12'',32),''hex''))','KAQ_LEG_ARGUMENT_INVALID');
  perform pg_temp.leg_actor(other_uid,other_sid);
  perform pg_temp.leg_expect('target_before_source','select kaq_private.issue_account_leg('||quote_literal(target_id)||','||quote_literal(secret)||',''target'',0,gen_random_uuid(),decode(repeat(''12'',32),''hex''))','KAQ_LEG_SIDE_STATE');
  before:=pg_temp.leg_snapshot();
  perform pg_temp.leg_actor(other_uid,alternate_sid);
  perform pg_temp.leg_expect('wrong_session_zero_change','select kaq_private.issue_account_leg('||quote_literal(target_id)||','||quote_literal(secret)||',''target'',0,gen_random_uuid(),decode(repeat(''12'',32),''hex''))','KAQ_INTENT_NOT_FOUND');
  perform pg_temp.leg_assert('wrong_session_preserves_all_rows',before=pg_temp.leg_snapshot());
  perform pg_temp.leg_actor(uid,sid);
  select to_jsonb(row) into before from kaq_private.account_intents row where id=intent_id;
  perform pg_temp.leg_expect('wrong_secret','select kaq_private.issue_account_leg('||quote_literal(intent_id)||','||quote_literal(repeat('0',64))||',''source'',0,gen_random_uuid(),decode(repeat(''12'',32),''hex''))','KAQ_INTENT_NOT_FOUND');
  perform pg_temp.leg_assert('wrong_secret_zero_change',before=(select to_jsonb(row) from kaq_private.account_intents row where id=intent_id));
  value:=kaq_private.issue_account_leg(intent_id,secret,'source',0,key,nonce);
  perform pg_temp.leg_assert('issue_canonical',(value->>'attempt')='1' and value->>'leg_state'='issued'
    and value->'guard' ?& array['purpose','intentId','legId','attempt','storageKey','issuedAt','expiresAt']
    and not(value::text ~ '(nonce|hash|verifier|token|cipher|url)'));
  perform pg_temp.leg_assert('issue_row',(select expected_uid=uid and prepare_idempotency_key=key
    and prepare_request_hash is not null and octet_length(prepare_request_hash)=32 and issued_at=date_trunc('milliseconds',issued_at)
    and expires_at=least((select test_intent.expires_at from kaq_private.account_intents test_intent where test_intent.id=(value->>'intent_id')::uuid),issued_at+interval '3 minutes')
    from kaq_private.account_proof_legs where id=(value->>'leg_id')::uuid));
  perform pg_temp.leg_assert('initial_runtime_guard_accepted',kaq_private.runtime_compare_and_swap((value->>'leg_id')::uuid,null,
    jsonb_build_object('revision',0,'keyVersion','v1','nonce',repeat('ab',12),'ciphertext',repeat('cd',16),
      'expiresAt',value->'guard'->'expiresAt'),value->'guard'));
  perform pg_temp.leg_assert('initial_runtime_guard_read',kaq_private.runtime_read((value->>'leg_id')::uuid,value->'guard')->>'revision'='0'
    and not kaq_private.runtime_is_terminal((value->>'leg_id')::uuid,value->'guard'));
  replay:=kaq_private.issue_account_leg(intent_id,secret,'source',0,key,nonce);
  perform pg_temp.leg_assert('same_body_replay',replay=value and (select revision from kaq_private.account_intents where id=intent_id)=1);
  before:=pg_temp.leg_snapshot();
  perform pg_temp.leg_expect('null_intent','select kaq_private.issue_account_leg(null,'||quote_literal(secret)||',''source'',1,gen_random_uuid(),decode(repeat(''13'',32),''hex''))','KAQ_INTENT_NOT_FOUND');
  perform pg_temp.leg_expect('null_secret','select kaq_private.issue_account_leg('||quote_literal(intent_id)||',null,''source'',1,gen_random_uuid(),decode(repeat(''13'',32),''hex''))','KAQ_INTENT_NOT_FOUND');
  perform pg_temp.leg_expect('null_side','select kaq_private.issue_account_leg('||quote_literal(intent_id)||','||quote_literal(secret)||',null,1,gen_random_uuid(),decode(repeat(''13'',32),''hex''))','KAQ_LEG_ARGUMENT_INVALID');
  perform pg_temp.leg_expect('null_revision','select kaq_private.issue_account_leg('||quote_literal(intent_id)||','||quote_literal(secret)||',''source'',null,gen_random_uuid(),decode(repeat(''13'',32),''hex''))','KAQ_LEG_ARGUMENT_INVALID');
  perform pg_temp.leg_expect('null_key','select kaq_private.issue_account_leg('||quote_literal(intent_id)||','||quote_literal(secret)||',''source'',1,null,decode(repeat(''13'',32),''hex''))','KAQ_LEG_ARGUMENT_INVALID');
  perform pg_temp.leg_expect('null_replace','select kaq_private.issue_account_leg('||quote_literal(intent_id)||','||quote_literal(secret)||',''source'',1,gen_random_uuid(),decode(repeat(''13'',32),''hex''),null)','KAQ_LEG_ARGUMENT_INVALID');
  perform pg_temp.leg_assert('null_inputs_zero_change',before=pg_temp.leg_snapshot());
  perform pg_temp.leg_actor(other_uid,other_sid);
  perform pg_temp.leg_expect('wrong_actor_zero_change','select kaq_private.issue_account_leg('||quote_literal(intent_id)||','||quote_literal(secret)||',''source'',1,gen_random_uuid(),decode(repeat(''13'',32),''hex''))','KAQ_INTENT_NOT_FOUND');
  perform pg_temp.leg_actor(uid,sid);
  perform pg_temp.leg_expect('stale_revision_zero_change','select kaq_private.issue_account_leg('||quote_literal(intent_id)||','||quote_literal(secret)||',''source'',99,gen_random_uuid(),decode(repeat(''13'',32),''hex''))','KAQ_LEG_STALE');
  perform pg_temp.leg_assert('wrong_actor_stale_zero_change',before=pg_temp.leg_snapshot());
  perform pg_temp.leg_expect('same_key_different_body','select kaq_private.issue_account_leg('||quote_literal(intent_id)||','||quote_literal(secret)||',''source'',0,'||quote_literal(key)||',decode(repeat(''13'',32),''hex''))','KAQ_LEG_IDEMPOTENCY_CONFLICT');
  update kaq_private.account_proof_legs set state='exchanging' where id=(value->>'leg_id')::uuid;
  perform pg_temp.leg_expect('active_requires_restart','select kaq_private.issue_account_leg('||quote_literal(intent_id)||','||quote_literal(secret)||',''source'',1,gen_random_uuid(),decode(repeat(''14'',32),''hex''))','KAQ_LEG_ACTIVE');
  value:=kaq_private.issue_account_leg(intent_id,secret,'source',1,gen_random_uuid(),decode(repeat('15',32),'hex'),true);
  perform pg_temp.leg_assert('restart_supersedes_exchanging',(value->>'attempt')='2' and (select count(*)=1 from kaq_private.account_proof_legs test_leg where test_leg.intent_id=(value->>'intent_id')::uuid and test_leg.state='superseded'));
  value:=kaq_private.issue_account_leg(intent_id,secret,'source',2,gen_random_uuid(),decode(repeat('16',32),'hex'),true);
  perform pg_temp.leg_assert('third_attempt',(value->>'attempt')='3' and (select revision from kaq_private.account_intents where id=intent_id)=3);
  value:=kaq_private.issue_account_leg(intent_id,secret,'source',3,gen_random_uuid(),decode(repeat('17',32),'hex'),true);
  perform pg_temp.leg_assert('fourth_terminal',(value->>'intent_state')='attempts_exhausted' and value->'leg_id' is null
    and (select count(*)=3 from kaq_private.account_proof_legs test_leg where test_leg.intent_id=(value->>'intent_id')::uuid));
  perform pg_temp.leg_actor(other_uid,other_sid);
  update kaq_private.account_intents set state='awaiting_target',revision=0 where id=target_id;
  value:=kaq_private.issue_account_leg(target_id,secret,'target',0,target_key,decode(repeat('18',32),'hex'));
  perform pg_temp.leg_assert('target_after_source_phase',(select expected_uid is null from kaq_private.account_proof_legs where id=(value->>'leg_id')::uuid));
  update kaq_private.account_proof_legs set state='exchanged',issued_at=clock_timestamp()-interval '2 minutes',expires_at=clock_timestamp()-interval '1 minute' where id=(value->>'leg_id')::uuid;
  replay:=kaq_private.issue_account_leg(target_id,secret,'target',0,target_key,decode(repeat('18',32),'hex'));
  perform pg_temp.leg_expect('expired_exchanged_still_requires_restart','select kaq_private.issue_account_leg('||quote_literal(target_id)||','||quote_literal(secret)||',''target'',1,gen_random_uuid(),decode(repeat(''20'',32),''hex''))','KAQ_LEG_ACTIVE');
  perform pg_temp.leg_assert('replay_exchanged_keeps_proof_ttl',replay->'guard'->>'expiresAt'=(select kaq_private.runtime_epoch_ms(expires_at)::text from kaq_private.account_intents where id=target_id));
  update kaq_private.account_proof_legs set state='proved' where id=(value->>'leg_id')::uuid;
  perform pg_temp.leg_expect('proved_state_fail_closed','select kaq_private.issue_account_leg('||quote_literal(target_id)||','||quote_literal(secret)||',''target'',1,gen_random_uuid(),decode(repeat(''22'',32),''hex''))','KAQ_LEG_PROVED_STATE');
  perform pg_temp.leg_assert('proved_not_reopened',(select state='proved' from kaq_private.account_proof_legs where id=(replay->>'leg_id')::uuid));
  perform pg_temp.leg_expect('schema_pair','insert into kaq_private.account_proof_legs(intent_id,side,attempt,storage_key,ingest_nonce_hash,expires_at,prepare_idempotency_key) values('||quote_literal(target_id)||',''source'',1,''pair-'||target_id||''',decode(repeat(''21'',32),''hex''),clock_timestamp()+interval ''1 minute'',gen_random_uuid())','new row for relation "account_proof_legs" violates check constraint "account_proof_legs_prepare_request_pair"');
  foreach role_name in array array['anon','authenticated','service_role'] loop
    perform pg_temp.leg_assert('table_acl_'||role_name,not has_table_privilege(role_name,'kaq_private.account_proof_legs','SELECT,INSERT,UPDATE,DELETE'));
    perform pg_temp.leg_assert('function_acl_'||role_name,not has_function_privilege(role_name,'kaq_private.issue_account_leg(uuid,text,text,bigint,uuid,bytea,boolean)','EXECUTE'));
  end loop;
  select * into fn from pg_proc where oid='kaq_private.issue_account_leg(uuid,text,text,bigint,uuid,bytea,boolean)'::regprocedure;
  perform pg_temp.leg_assert('definer_fixed_path',fn.prosecdef and fn.provolatile='v' and fn.proconfig @> array['search_path=pg_catalog, auth, kaq_private, extensions']);
end $$;
select jsonb_build_object('status','passed','checks',(select count(*) from leg_checks),'names',(select jsonb_agg(name order by name) from leg_checks));
rollback;
