begin;
create temporary table cleanup_checks(name text primary key) on commit drop;
create function pg_temp.cleanup_check(name text, value boolean) returns void language plpgsql as $$
begin
  if value is distinct from true then raise exception 'cleanup assertion failed: %', name; end if;
  insert into cleanup_checks values(name);
end $$;
do $$
declare
  intent_id uuid := gen_random_uuid(); leg_id uuid := gen_random_uuid(); expired_intent uuid := gen_random_uuid(); expired_leg uuid := gen_random_uuid();
  v_leg uuid;
  issued timestamptz := date_trunc('milliseconds', clock_timestamp()); expiry timestamptz := issued + interval '2 minutes';
  guard jsonb; proof_guard jsonb; record jsonb;
begin
  insert into kaq_private.account_intents(id,kind,actor_uid,actor_session_id,secret_hash,expires_at)
    values(intent_id,'add_existing',gen_random_uuid(),gen_random_uuid(),decode(repeat('11',32),'hex'),issued + interval '9 minutes');
  insert into kaq_private.account_proof_legs(id,intent_id,side,attempt,storage_key,ingest_nonce_hash,issued_at,expires_at)
    values(leg_id,intent_id,'source',1,'kaq-proof:'||intent_id||':'||leg_id||':1',decode(repeat('22',32),'hex'),issued,expiry);
  guard := jsonb_build_object('purpose','leg','intentId',intent_id,'legId',leg_id,'attempt',1,
    'storageKey','kaq-proof:'||intent_id||':'||leg_id||':1','issuedAt',kaq_private.runtime_epoch_ms(issued),'expiresAt',kaq_private.runtime_epoch_ms(expiry));
  record := jsonb_build_object('revision',0,'keyVersion','v1','nonce',repeat('ab',12),'ciphertext',repeat('cd',16),'expiresAt',kaq_private.runtime_epoch_ms(expiry));
  perform pg_temp.cleanup_check('initial_missing',kaq_private.runtime_cleanup_revision(leg_id,guard) is null);
  perform pg_temp.cleanup_check('saved',kaq_private.runtime_compare_and_swap(leg_id,null,record,guard));
  update kaq_private.account_intents set state='cancelled' where id=intent_id;
  perform pg_temp.cleanup_check('cancelled_read_hidden',kaq_private.runtime_read(leg_id,guard) is null);
  perform pg_temp.cleanup_check('cancelled_revision_visible',kaq_private.runtime_cleanup_revision(leg_id,guard)=0);
  perform pg_temp.cleanup_check('strict_null_stays_conflict',kaq_private.runtime_delete_if_revision(leg_id,null,guard)='conflict');
  perform pg_temp.cleanup_check('cancelled_delete',kaq_private.runtime_delete_if_revision(leg_id,0,guard)='deleted');
  update kaq_private.account_intents set state='awaiting_source' where id=intent_id;
  perform pg_temp.cleanup_check('resaved',kaq_private.runtime_compare_and_swap(leg_id,null,record,guard));
  perform pg_temp.cleanup_check('old_revision',kaq_private.runtime_cleanup_revision(leg_id,guard)=0);
  v_leg := leg_id;
  update kaq_private.account_proof_runtime set revision=1 where account_proof_runtime.leg_id=v_leg;
  perform pg_temp.cleanup_check('stale_delete_fenced',kaq_private.runtime_delete_if_revision(leg_id,0,guard)='conflict');
  update kaq_private.account_proof_legs set state='exchanging' where id=leg_id;
  proof_guard := guard || jsonb_build_object('purpose','proof','expiresAt',kaq_private.runtime_epoch_ms(issued + interval '9 minutes'));
  update kaq_private.account_proof_runtime set phase='proof',expires_at=issued + interval '9 minutes' where account_proof_runtime.leg_id=v_leg;
  update kaq_private.account_proof_legs set state='exchanged' where id=leg_id;
  perform pg_temp.cleanup_check('old_phase_has_no_revision',kaq_private.runtime_cleanup_revision(leg_id,guard) is null);
  perform pg_temp.cleanup_check('old_phase_cannot_delete',kaq_private.runtime_delete_if_revision(leg_id,null,guard)='conflict');
  perform pg_temp.cleanup_check('proof_revision_visible',kaq_private.runtime_cleanup_revision(leg_id,proof_guard)=1);
  insert into kaq_private.account_intents(id,kind,actor_uid,actor_session_id,secret_hash,expires_at)
    values(expired_intent,'add_existing',gen_random_uuid(),gen_random_uuid(),decode(repeat('33',32),'hex'),clock_timestamp()+interval '3 minutes');
  insert into kaq_private.account_proof_legs(id,intent_id,side,attempt,storage_key,ingest_nonce_hash,issued_at,expires_at)
    values(expired_leg,expired_intent,'source',1,'kaq-proof:'||expired_intent||':'||expired_leg||':1',decode(repeat('44',32),'hex'),date_trunc('milliseconds',clock_timestamp()),clock_timestamp()+interval '1 second');
  guard := jsonb_build_object('purpose','leg','intentId',expired_intent,'legId',expired_leg,'attempt',1,
    'storageKey','kaq-proof:'||expired_intent||':'||expired_leg||':1','issuedAt',kaq_private.runtime_epoch_ms((select issued_at from kaq_private.account_proof_legs where id=expired_leg)),
    'expiresAt',kaq_private.runtime_epoch_ms((select expires_at from kaq_private.account_proof_legs where id=expired_leg)));
  record := jsonb_build_object('revision',0,'keyVersion','v1','nonce',repeat('ef',12),'ciphertext',repeat('cd',16),'expiresAt',guard->'expiresAt');
  perform pg_temp.cleanup_check('expiry_saved',kaq_private.runtime_compare_and_swap(expired_leg,null,record,guard));
  while kaq_private.runtime_epoch_ms(clock_timestamp()) < (guard->>'expiresAt')::bigint loop perform 1; end loop;
  perform pg_temp.cleanup_check('expired_read_hidden',kaq_private.runtime_read(expired_leg,guard) is null);
  perform pg_temp.cleanup_check('expired_revision_visible',kaq_private.runtime_cleanup_revision(expired_leg,guard)=0);
  perform pg_temp.cleanup_check('expired_delete',kaq_private.runtime_delete_if_revision(expired_leg,0,guard)='deleted');
end $$;
do $$
declare role_name text;
begin
  foreach role_name in array array['anon','authenticated','service_role'] loop
    perform pg_temp.cleanup_check('acl_'||role_name,not has_function_privilege(role_name,'kaq_private.runtime_cleanup_revision(uuid,jsonb)'::regprocedure,'EXECUTE'));
  end loop;
end $$;
select jsonb_build_object('status','passed','checks',(select count(*) from cleanup_checks));
rollback;
