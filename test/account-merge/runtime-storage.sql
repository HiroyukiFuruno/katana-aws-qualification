begin;
create temporary table runtime_checks(name text primary key) on commit drop;
create function pg_temp.runtime_check(name text, value boolean) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'runtime assertion failed: %', name; end if; insert into runtime_checks values(name); end $$;
do $$
declare i uuid:=gen_random_uuid(); l uuid:=gen_random_uuid(); expired_i uuid:=gen_random_uuid(); expired_l uuid:=gen_random_uuid(); late_i uuid:=gen_random_uuid(); late_l uuid:=gen_random_uuid();
  issued timestamptz:=date_trunc('milliseconds',clock_timestamp()); leg_expiry timestamptz:=issued+interval '2 seconds'; intent_expiry timestamptz:=issued+interval '9 minutes';
  late_issued timestamptz; late_intent_expiry timestamptz; late_leg_expiry timestamptz; late_guard jsonb; late_next jsonb; late_baseline jsonb;
  guard jsonb; proof_guard jsonb; next jsonb; baseline jsonb; field text; altered jsonb; revision bigint;
begin
  insert into kaq_private.account_intents(id,kind,actor_uid,actor_session_id,secret_hash,expires_at)
    values(i,'add_existing',gen_random_uuid(),gen_random_uuid(),decode(repeat('11',32),'hex'),intent_expiry);
  insert into kaq_private.account_proof_legs(id,intent_id,side,attempt,storage_key,ingest_nonce_hash,issued_at,expires_at)
    values(l,i,'source',1,'kaq-proof:'||i||':'||l||':1',decode(repeat('22',32),'hex'),issued,leg_expiry);
  guard:=jsonb_build_object('purpose','leg','intentId',i,'legId',l,'attempt',1,'storageKey','kaq-proof:'||i||':'||l||':1',
    'issuedAt',kaq_private.runtime_epoch_ms(issued),'expiresAt',kaq_private.runtime_epoch_ms(leg_expiry));
  next:=jsonb_build_object('revision',0,'keyVersion','v1','nonce',repeat('ab',12),'ciphertext',repeat('cd',16),'expiresAt',kaq_private.runtime_epoch_ms(leg_expiry));
  perform pg_temp.runtime_check('initial_absent_not_terminal',not kaq_private.runtime_is_terminal(l,guard));
  perform pg_temp.runtime_check('initial_null_guard_terminal',kaq_private.runtime_is_terminal(l,jsonb_set(guard,array['purpose'],'null'::jsonb)));
  perform pg_temp.runtime_check('next_null_expected_rejected',not kaq_private.runtime_next_valid(next,null,leg_expiry));
  perform pg_temp.runtime_check('initial_cas',kaq_private.runtime_compare_and_swap(l,null,next,guard));
  baseline:=(select to_jsonb(r) from kaq_private.account_proof_runtime r where leg_id=l);
  foreach field in array array['purpose','intentId','legId','attempt','storageKey','issuedAt','expiresAt'] loop
    altered:=jsonb_set(guard,array[field],case field when 'purpose' then '"proof"'::jsonb when 'intentId' then to_jsonb(gen_random_uuid()::text)
      when 'legId' then to_jsonb(gen_random_uuid()::text) when 'attempt' then '2'::jsonb when 'storageKey' then '"different"'::jsonb
      when 'issuedAt' then to_jsonb((guard->>'issuedAt')::bigint+1) else to_jsonb((guard->>'expiresAt')::bigint+1) end);
    perform pg_temp.runtime_check('guard_'||field,not kaq_private.runtime_compare_and_swap(l,0,next,altered));
    perform pg_temp.runtime_check('guard_'||field||'_unchanged',(select to_jsonb(r) from kaq_private.account_proof_runtime r where leg_id=l)=baseline);
    altered:=jsonb_set(guard,array[field],'null'::jsonb);
    perform pg_temp.runtime_check('guard_null_'||field,not kaq_private.runtime_compare_and_swap(l,0,next,altered));
    perform pg_temp.runtime_check('guard_null_'||field||'_unchanged',(select to_jsonb(r) from kaq_private.account_proof_runtime r where leg_id=l)=baseline);
  end loop;
  perform pg_temp.runtime_check('bad_key',not kaq_private.runtime_compare_and_swap(l,0,next||jsonb_build_object('keyVersion','bad key'),guard));
  perform pg_temp.runtime_check('bad_key_unchanged',(select to_jsonb(r) from kaq_private.account_proof_runtime r where leg_id=l)=baseline);
  perform pg_temp.runtime_check('bad_nonce',not kaq_private.runtime_compare_and_swap(l,0,next||jsonb_build_object('nonce','01'),guard));
  perform pg_temp.runtime_check('bad_nonce_unchanged',(select to_jsonb(r) from kaq_private.account_proof_runtime r where leg_id=l)=baseline);
  perform pg_temp.runtime_check('bad_cipher',not kaq_private.runtime_compare_and_swap(l,0,next||jsonb_build_object('ciphertext','01'),guard));
  perform pg_temp.runtime_check('bad_cipher_unchanged',(select to_jsonb(r) from kaq_private.account_proof_runtime r where leg_id=l)=baseline);
  perform pg_temp.runtime_check('bad_revision',not kaq_private.runtime_compare_and_swap(l,0,next||jsonb_build_object('revision',7),guard));
  perform pg_temp.runtime_check('bad_revision_unchanged',(select to_jsonb(r) from kaq_private.account_proof_runtime r where leg_id=l)=baseline);
  foreach field in array array['revision','keyVersion','nonce','ciphertext','expiresAt'] loop
    perform pg_temp.runtime_check('next_null_'||field,not kaq_private.runtime_compare_and_swap(l,0,jsonb_set(next,array[field],'null'::jsonb),guard));
    perform pg_temp.runtime_check('next_null_'||field||'_unchanged',(select to_jsonb(r) from kaq_private.account_proof_runtime r where leg_id=l)=baseline);
  end loop;
  perform pg_temp.runtime_check('key_65_rejected',not kaq_private.runtime_compare_and_swap(l,0,next||jsonb_build_object('keyVersion',repeat('a',65)),guard));
  perform pg_temp.runtime_check('key_65_unchanged',(select to_jsonb(r) from kaq_private.account_proof_runtime r where leg_id=l)=baseline);
  perform pg_temp.runtime_check('revision_unsafe_rejected',not kaq_private.runtime_compare_and_swap(l,0,next||jsonb_build_object('revision',9007199254740992),guard));
  perform pg_temp.runtime_check('revision_unsafe_unchanged',(select to_jsonb(r) from kaq_private.account_proof_runtime r where leg_id=l)=baseline);
  update kaq_private.account_proof_runtime set revision=9007199254740992 where leg_id=l;
  late_baseline:=(select to_jsonb(r) from kaq_private.account_proof_runtime r where leg_id=l);
  perform pg_temp.runtime_check('corrupt_revision_rejected',not kaq_private.runtime_compare_and_swap(l,9007199254740992,next,guard));
  perform pg_temp.runtime_check('corrupt_revision_unchanged',(select to_jsonb(r) from kaq_private.account_proof_runtime r where leg_id=l)=late_baseline);
  update kaq_private.account_proof_runtime set revision=0 where leg_id=l;
  perform pg_temp.runtime_check('stale_revision',not kaq_private.runtime_compare_and_swap(l,7,next,guard));
  perform pg_temp.runtime_check('stale_revision_unchanged',(select to_jsonb(r) from kaq_private.account_proof_runtime r where leg_id=l)=baseline);
  foreach field in array array['superseded','failed','exchange_unknown'] loop
    update kaq_private.account_proof_legs set state=field where id=l;
    perform pg_temp.runtime_check('terminal_'||field,kaq_private.runtime_is_terminal(l,guard));
    perform pg_temp.runtime_check('terminal_'||field||'_cas',not kaq_private.runtime_compare_and_swap(l,0,next,guard));
    update kaq_private.account_proof_legs set state='issued' where id=l;
  end loop;
  update kaq_private.account_intents set state='cancelled' where id=i;
  perform pg_temp.runtime_check('terminal_cancelled',kaq_private.runtime_is_terminal(l,guard));
  perform pg_temp.runtime_check('terminal_cancelled_cas',not kaq_private.runtime_compare_and_swap(l,0,next,guard));
  update kaq_private.account_intents set state='awaiting_source' where id=i;
  update kaq_private.account_proof_legs set state='exchanging' where id=l;
  proof_guard:=guard||jsonb_build_object('purpose','proof','expiresAt',kaq_private.runtime_epoch_ms(intent_expiry));
  next:=next||jsonb_build_object('revision',1,'nonce',repeat('ef',12),'expiresAt',kaq_private.runtime_epoch_ms(intent_expiry));
  perform pg_temp.runtime_check('promotion_null_leg_revision',not kaq_private.runtime_promote_proof(l,null,guard,proof_guard,next));
  perform pg_temp.runtime_check('promote',kaq_private.runtime_promote_proof(l,0,guard,proof_guard,next));
  perform pg_temp.runtime_check('promotion_advances_leg_revision',(select proof_leg.revision from kaq_private.account_proof_legs proof_leg where proof_leg.id=l)=1);
  perform pg_temp.runtime_check('promotion_once',not kaq_private.runtime_promote_proof(l,0,guard,proof_guard,next));
  perform pg_temp.runtime_check('old_leg_write',not kaq_private.runtime_compare_and_swap(l,1,next,guard));
  perform pg_temp.runtime_check('old_leg_cleanup',kaq_private.runtime_delete_if_revision(l,1,guard)='conflict');
  while clock_timestamp() < leg_expiry loop perform 1; end loop;
  perform pg_temp.runtime_check('proof_survives_leg_expiry',not kaq_private.runtime_is_terminal(l,proof_guard));
  perform pg_temp.runtime_check('proof_read',kaq_private.runtime_read(l,proof_guard)->>'revision'='1');
  update kaq_private.account_proof_legs set state='proved' where id=l;
  perform pg_temp.runtime_check('proved_proof_live',not kaq_private.runtime_is_terminal(l,proof_guard));
  next:=next||jsonb_build_object('revision',2,'nonce',repeat('12',12));
  perform pg_temp.runtime_check('proof_rewrite',kaq_private.runtime_compare_and_swap(l,1,next,proof_guard));
  update kaq_private.account_proof_legs set state='failed' where id=l;
  perform pg_temp.runtime_check('failed_proof_terminal',kaq_private.runtime_is_terminal(l,proof_guard));
  perform pg_temp.runtime_check('failed_proof_read_hidden',kaq_private.runtime_read(l,proof_guard) is null);
  update kaq_private.account_proof_legs set state='proved' where id=l;
  perform pg_temp.runtime_check('proof_cleanup',kaq_private.runtime_delete_if_revision(l,2,proof_guard)='deleted');
  perform pg_temp.runtime_check('proof_missing',kaq_private.runtime_delete_if_revision(l,2,proof_guard)='missing');
  insert into kaq_private.account_intents(id,kind,actor_uid,actor_session_id,secret_hash,expires_at)
    values(expired_i,'add_existing',gen_random_uuid(),gen_random_uuid(),decode(repeat('33',32),'hex'),clock_timestamp()+interval '1 millisecond');
  insert into kaq_private.account_proof_legs(id,intent_id,side,attempt,storage_key,ingest_nonce_hash,expires_at)
    values(expired_l,expired_i,'source',1,'kaq-proof:'||expired_i||':'||expired_l||':1',decode(repeat('44',32),'hex'),clock_timestamp()+interval '1 minute');
  guard:=jsonb_build_object('purpose','leg','intentId',expired_i,'legId',expired_l,'attempt',1,'storageKey','kaq-proof:'||expired_i||':'||expired_l||':1',
    'issuedAt',kaq_private.runtime_epoch_ms((select issued_at from kaq_private.account_proof_legs where id=expired_l)),
    'expiresAt',kaq_private.runtime_epoch_ms((select expires_at from kaq_private.account_proof_legs where id=expired_l)));
  while clock_timestamp() < (select expires_at from kaq_private.account_intents where id=expired_i) loop perform 1; end loop;
  next:=jsonb_build_object('revision',0,'keyVersion','v1','nonce',repeat('ab',12),'ciphertext',repeat('cd',16),'expiresAt',guard->'expiresAt');
  perform pg_temp.runtime_check('expired_intent_rejected',not kaq_private.runtime_compare_and_swap(expired_l,null,next,guard));
  late_issued:=date_trunc('milliseconds',clock_timestamp()); late_intent_expiry:=late_issued+interval '700 milliseconds'; late_leg_expiry:=late_issued+interval '2 minutes';
  insert into kaq_private.account_intents(id,kind,actor_uid,actor_session_id,secret_hash,expires_at)
    values(late_i,'add_existing',gen_random_uuid(),gen_random_uuid(),decode(repeat('55',32),'hex'),late_intent_expiry);
  insert into kaq_private.account_proof_legs(id,intent_id,side,attempt,storage_key,ingest_nonce_hash,issued_at,expires_at)
    values(late_l,late_i,'source',1,'kaq-proof:'||late_i||':'||late_l||':1',decode(repeat('66',32),'hex'),late_issued,late_leg_expiry);
  late_guard:=jsonb_build_object('purpose','leg','intentId',late_i,'legId',late_l,'attempt',1,'storageKey','kaq-proof:'||late_i||':'||late_l||':1',
    'issuedAt',kaq_private.runtime_epoch_ms(late_issued),'expiresAt',kaq_private.runtime_epoch_ms(late_leg_expiry));
  late_next:=jsonb_build_object('revision',0,'keyVersion','v1','nonce',repeat('ab',12),'ciphertext',repeat('cd',16),'expiresAt',kaq_private.runtime_epoch_ms(late_leg_expiry));
  perform pg_temp.runtime_check('late_leg_initial_cas',kaq_private.runtime_compare_and_swap(late_l,null,late_next,late_guard));
  late_baseline:=(select to_jsonb(r) from kaq_private.account_proof_runtime r where leg_id=late_l);
  while kaq_private.runtime_epoch_ms(clock_timestamp()) < kaq_private.runtime_epoch_ms(late_intent_expiry) loop perform 1; end loop;
  perform pg_temp.runtime_check('late_leg_intent_state_stays_active',(select state from kaq_private.account_intents where id=late_i)='awaiting_source');
  perform pg_temp.runtime_check('late_leg_intent_deadline_terminal',kaq_private.runtime_is_terminal(late_l,late_guard));
  perform pg_temp.runtime_check('late_leg_intent_deadline_read_hidden',kaq_private.runtime_read(late_l,late_guard) is null);
  perform pg_temp.runtime_check('late_leg_intent_deadline_cas_rejected',not kaq_private.runtime_compare_and_swap(late_l,0,late_next||jsonb_build_object('revision',1),late_guard));
  perform pg_temp.runtime_check('late_leg_intent_deadline_unchanged',(select to_jsonb(r) from kaq_private.account_proof_runtime r where leg_id=late_l)=late_baseline);
  delete from kaq_private.account_intents where id in (i,expired_i,late_i);
end $$;
do $$
declare role_name text; fn regprocedure;
begin
  foreach role_name in array array['anon','authenticated','service_role'] loop
    perform pg_temp.runtime_check('schema_acl_'||role_name,not has_schema_privilege(role_name,'kaq_private','USAGE'));
    perform pg_temp.runtime_check('table_acl_'||role_name,not has_table_privilege(role_name,'kaq_private.account_proof_runtime','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'));
    for fn in select oid::regprocedure from pg_proc where pronamespace='kaq_private'::regnamespace and proname like 'runtime_%' order by oid loop
      perform pg_temp.runtime_check('acl_'||role_name||'_'||fn::text,not has_function_privilege(role_name,fn,'EXECUTE'));
    end loop;
  end loop;
  perform pg_temp.runtime_check('phase_constraint',not exists(select 1 from kaq_private.account_proof_runtime where phase not in ('leg','proof')));
end $$;
select jsonb_build_object('status','passed','checks',(select count(*) from runtime_checks),'names',(select jsonb_agg(name order by name) from runtime_checks));
rollback;
