-- 実GoTrueの3 user/4 sessionを置換する。nonceはPLpgSQL local/GUC内だけで扱い、結果/logへ出さない。
begin;
create temporary table intent_checks(name text primary key) on commit drop;
create function pg_temp.intent_assert(label text, passed boolean) returns void language plpgsql as $$
begin
  if passed is distinct from true then raise exception 'Intent assertion failed: %',label; end if;
  insert into intent_checks values(label);
end $$;
create function pg_temp.intent_expect(label text, statement text, expected_state text, expected_message text default null)
returns void language plpgsql as $$
declare actual_state text; actual_message text;
begin
  begin
    execute statement;
    raise exception 'Intent accepted invalid input: %',label;
  exception when others then
    get stacked diagnostics actual_state=returned_sqlstate,actual_message=message_text;
    if actual_state<>expected_state or (expected_message is not null and actual_message<>expected_message) then
      raise exception 'Intent % expected %/%, got %/%',label,expected_state,expected_message,actual_state,actual_message;
    end if;
  end;
  perform pg_temp.intent_assert(label,true);
end $$;
create function pg_temp.intent_actor(uid uuid,sid uuid) returns void language plpgsql as $$
declare headers jsonb;
begin
  perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'session_id',sid,'role','authenticated',
    'aud','authenticated','exp',floor(extract(epoch from clock_timestamp()))+3600)::text,true);
  select jsonb_build_object('x-kaq-account-id',account_id::text,'x-kaq-membership-epoch',epoch::text)
    into headers from kaq_private.learning_memberships where auth_user_id=uid;
  perform set_config('request.headers',coalesce(headers,'{}'::jsonb)::text,true);
end $$;
create function pg_temp.remember_intent(value jsonb) returns void language plpgsql as $$
begin
  perform set_config('intent_probe.id',value->>'id',true);
  perform set_config('intent_probe.secret',value->>'secret',true);
end $$;
do $$
declare
  first_uid uuid:='__FIRST_USER__'; second_uid uuid:='__SECOND_USER__'; third_uid uuid:='__THIRD_USER__';
  first_sid uuid:='__FIRST_SESSION__'; second_sid uuid:='__SECOND_SESSION__'; third_sid uuid:='__THIRD_SESSION__';
  alternate_sid uuid:='__SECOND_ALT_SESSION__'; key uuid; value jsonb; replay jsonb; original jsonb;
  old_id uuid; old_secret text; checked_at timestamptz; i integer; receipt_id uuid; function_record record; role_name text;
begin
  perform pg_temp.intent_assert('four_real_sessions',(
    select count(*)=4 from auth.sessions where (user_id=first_uid and id=first_sid)
      or (user_id=second_uid and id in(second_sid,alternate_sid)) or(user_id=third_uid and id=third_sid)));
  insert into kaq_private.learning_accounts(id) values(first_uid);
  insert into kaq_private.learning_memberships(auth_user_id,account_id) values(first_uid,first_uid);
  insert into public.learning_state(user_id) values(first_uid);
  insert into kaq_private.learning_session_grants(session_id,auth_user_id,account_id,membership_epoch,reason)
    values(first_sid,first_uid,first_uid,0,'legacy');
  perform pg_temp.intent_actor(first_uid,first_sid);
  begin
    value:=kaq_private.begin_account_intent('merge_existing',gen_random_uuid());
    if value->>'source_state'<>'ready' or value->>'secret' !~ '^[0-9a-f]{64}$'
      or not exists(select 1 from kaq_private.account_intents where id=(value->>'id')::uuid
        and source_account_id=first_uid and source_membership_epoch=0 and expires_at=created_at+interval '10 minutes'
        and secret_hash=extensions.digest(decode(value->>'secret','hex'),'sha256')) then
      raise exception 'Merge source/secret/TTL mismatch';
    end if;
    raise sqlstate 'ZX001';
  exception when sqlstate 'ZX001' then null;
  end;
  perform pg_temp.intent_assert('ready_merge_source_secret_hash_exact_ttl',true);
  perform pg_temp.intent_expect('assigned_cannot_use_add_kind',
    'select kaq_private.begin_account_intent(''add_existing'',gen_random_uuid())','PT409','KAQ_INTENT_SOURCE_STATE');
  perform pg_temp.intent_expect('disabled_merge_source',
    'do $x$ begin update kaq_private.learning_memberships set status=''disabled''; perform kaq_private.begin_account_intent(''merge_existing'',gen_random_uuid()); end $x$',
    'PT403','KAQ_ACCOUNT_DISABLED');
  perform pg_temp.intent_expect('revoked_merge_source',
    'do $x$ begin update kaq_private.learning_session_grants set revoked_at=clock_timestamp(); perform kaq_private.begin_account_intent(''merge_existing'',gen_random_uuid()); end $x$',
    'PT401','KAQ_REAUTHENTICATION_REQUIRED');
  perform pg_temp.intent_actor(second_uid,second_sid);
  perform pg_temp.intent_expect('schema_null_pair_guard',
    'insert into kaq_private.account_intents(kind,actor_uid,actor_session_id,secret_hash,state,expires_at,begin_idempotency_key)
      values(''add_existing'',(current_setting(''request.jwt.claims'')::jsonb->>''sub'')::uuid,
      (current_setting(''request.jwt.claims'')::jsonb->>''session_id'')::uuid,decode(repeat(''ab'',32),''hex''),
      ''cancelled'',clock_timestamp()+interval ''5 minutes'',gen_random_uuid())','23514');
  perform pg_temp.intent_expect('schema_hash_length_guard',
    'insert into kaq_private.account_intents(kind,actor_uid,actor_session_id,secret_hash,state,expires_at,begin_idempotency_key,begin_request_hash)
      values(''add_existing'',(current_setting(''request.jwt.claims'')::jsonb->>''sub'')::uuid,
      (current_setting(''request.jwt.claims'')::jsonb->>''session_id'')::uuid,decode(repeat(''ab'',32),''hex''),
      ''cancelled'',clock_timestamp()+interval ''5 minutes'',gen_random_uuid(),decode(''ab'',''hex''))','23514');
  perform pg_temp.intent_expect('unassigned_cannot_use_merge_kind',
    'select kaq_private.begin_account_intent(''merge_existing'',gen_random_uuid())','PT409','KAQ_INTENT_SOURCE_STATE');
  perform pg_temp.intent_expect('invalid_kind','select kaq_private.begin_account_intent(''other'',gen_random_uuid())','PT400','KAQ_INTENT_ARGUMENT_INVALID');
  perform pg_temp.intent_expect('null_key','select kaq_private.begin_account_intent(''add_existing'',null)','PT400','KAQ_INTENT_ARGUMENT_INVALID');
  perform pg_temp.intent_expect('zero_key','select kaq_private.begin_account_intent(''add_existing'',''00000000-0000-0000-0000-000000000000'')','PT400','KAQ_INTENT_ARGUMENT_INVALID');
  key:=gen_random_uuid(); value:=kaq_private.begin_account_intent('add_existing',key);
  perform pg_temp.remember_intent(value);
  select to_jsonb(row) into original from kaq_private.account_intents row where id=(value->>'id')::uuid;
  perform set_config('request.jwt.claims',(current_setting('request.jwt.claims')::jsonb||'{"exp":1}'::jsonb)::text,true);
  perform pg_temp.intent_expect('expired_jwt_status_rejected',
    'select kaq_private.read_account_intent(current_setting(''intent_probe.id'')::uuid,current_setting(''intent_probe.secret''))','28000','KAQ_AUTH_CONTEXT_INVALID');
  perform pg_temp.intent_expect('expired_jwt_cancel_rejected',
    'select kaq_private.cancel_account_intent(current_setting(''intent_probe.id'')::uuid,current_setting(''intent_probe.secret''),0)','28000','KAQ_AUTH_CONTEXT_INVALID');
  perform pg_temp.intent_expect('expired_jwt_add_begin_rejected',
    'select kaq_private.begin_account_intent(''add_existing'',gen_random_uuid())','28000','KAQ_AUTH_CONTEXT_INVALID');
  perform pg_temp.intent_assert('expired_jwt_requests_leave_intent_unchanged',original=(
    select to_jsonb(row) from kaq_private.account_intents row where id=(value->>'id')::uuid));
  perform pg_temp.intent_actor(second_uid,second_sid);
  perform pg_temp.intent_assert('onboarding_source_frozen',value->>'source_state'='onboarding_required' and exists(
    select 1 from kaq_private.account_intents where id=(value->>'id')::uuid and actor_uid=second_uid and actor_session_id=second_sid
      and source_account_id is null and source_membership_epoch is null));
  replay:=kaq_private.begin_account_intent('add_existing',key);
  perform pg_temp.intent_assert('idempotent_same_id_without_secret',replay->>'id'=value->>'id'
    and replay->>'state'=value->>'state' and replay->>'expires_at'=value->>'expires_at' and not(replay?'secret')
    and replay->'recovery_required'='true'::jsonb and replay->'secret_recoverable'='false'::jsonb);
  perform set_config('intent_probe.key',key::text,true);
  perform pg_temp.intent_expect('idempotency_kind_conflict',
    'select kaq_private.begin_account_intent(''merge_existing'',current_setting(''intent_probe.key'')::uuid)','PT409','KAQ_INTENT_IDEMPOTENCY_CONFLICT');
  perform pg_temp.intent_expect('idempotency_replace_conflict',
    'select kaq_private.begin_account_intent(''add_existing'',current_setting(''intent_probe.key'')::uuid,true)','PT409','KAQ_INTENT_IDEMPOTENCY_CONFLICT');
  select to_jsonb(row) into original from kaq_private.account_intents row where id=(value->>'id')::uuid;
  perform pg_temp.intent_expect('wrong_secret_404',
    'select kaq_private.read_account_intent(current_setting(''intent_probe.id'')::uuid,repeat(''0'',64))','PT404','KAQ_INTENT_NOT_FOUND');
  perform pg_temp.intent_expect('unknown_id_404',
    'select kaq_private.read_account_intent(gen_random_uuid(),current_setting(''intent_probe.secret''))','PT404','KAQ_INTENT_NOT_FOUND');
  perform pg_temp.intent_actor(third_uid,third_sid);
  perform pg_temp.intent_expect('other_actor_404',
    'select kaq_private.read_account_intent(current_setting(''intent_probe.id'')::uuid,current_setting(''intent_probe.secret''))','PT404','KAQ_INTENT_NOT_FOUND');
  perform pg_temp.intent_actor(second_uid,alternate_sid);
  perform pg_temp.intent_expect('other_session_404',
    'select kaq_private.cancel_account_intent(current_setting(''intent_probe.id'')::uuid,current_setting(''intent_probe.secret''),0)','PT404','KAQ_INTENT_NOT_FOUND');
  perform pg_temp.intent_expect('other_session_idempotency_conflict',
    'select kaq_private.begin_account_intent(''add_existing'',current_setting(''intent_probe.key'')::uuid)','PT409','KAQ_INTENT_IDEMPOTENCY_CONFLICT');
  perform pg_temp.intent_actor(second_uid,second_sid);
  perform pg_temp.intent_assert('invalid_requests_do_not_change_row',original=(select to_jsonb(row)
    from kaq_private.account_intents row where id=(value->>'id')::uuid));
  perform pg_temp.intent_assert('invalid_requests_create_no_legs',not exists(select 1 from kaq_private.account_proof_legs));
  perform pg_temp.intent_expect('cancel_stale_version',
    'select kaq_private.cancel_account_intent(current_setting(''intent_probe.id'')::uuid,current_setting(''intent_probe.secret''),99)','PT409','KAQ_INTENT_STALE');
  replay:=kaq_private.cancel_account_intent((value->>'id')::uuid,value->>'secret',0);
  perform pg_temp.intent_assert('cancel_once',replay->>'state'='cancelled' and replay->>'version'='1');
  replay:=kaq_private.cancel_account_intent((value->>'id')::uuid,value->>'secret',0);
  perform pg_temp.intent_assert('cancel_terminal_retry_no_increment',replay->>'state'='cancelled' and replay->>'version'='1');
  replay:=kaq_private.begin_account_intent('add_existing',key);
  perform pg_temp.intent_assert('idempotent_terminal_stays_terminal',replay->>'id'=value->>'id' and replay->>'state'='cancelled' and not(replay?'secret'));

  delete from kaq_private.account_intents where actor_uid=second_uid;
  value:=kaq_private.begin_account_intent('add_existing',gen_random_uuid()); old_id:=(value->>'id')::uuid;old_secret:=value->>'secret';
  perform pg_temp.intent_expect('one_active_actor','select kaq_private.begin_account_intent(''add_existing'',gen_random_uuid())','PT409','KAQ_INTENT_ACTIVE');
  perform pg_temp.intent_actor(second_uid,alternate_sid);
  perform pg_temp.intent_expect('new_session_cannot_replace_active','select kaq_private.begin_account_intent(''add_existing'',gen_random_uuid(),true)','PT409','KAQ_INTENT_ACTIVE');
  perform pg_temp.intent_actor(second_uid,second_sid);
  value:=kaq_private.begin_account_intent('add_existing',gen_random_uuid(),true);
  perform pg_temp.intent_assert('replace_cancels_old_and_rotates_secret',(value->>'id')::uuid<>old_id and value->>'secret'<>old_secret
    and (select state='cancelled' and revision=1 from kaq_private.account_intents where id=old_id)
    and (select count(*)=1 from kaq_private.account_intents where actor_uid=second_uid and state='awaiting_source'));
  replay:=kaq_private.read_account_intent(old_id,old_secret);
  perform pg_temp.intent_assert('old_secret_only_reads_cancelled_intent',replay->>'state'='cancelled');

  delete from kaq_private.account_intents where actor_uid=second_uid;
  for i in 1..5 loop
    key:=gen_random_uuid();value:=kaq_private.begin_account_intent('add_existing',key);
    perform kaq_private.cancel_account_intent((value->>'id')::uuid,value->>'secret',0);
  end loop;
  perform pg_temp.intent_expect('cancelled_starts_count_toward_rate',
    'select kaq_private.begin_account_intent(''add_existing'',gen_random_uuid())','PT429','KAQ_INTENT_RATE_LIMITED');
  replay:=kaq_private.begin_account_intent('add_existing',key);
  perform pg_temp.intent_assert('idempotent_replay_does_not_consume_rate',replay->>'state'='cancelled'
    and (select count(*)=5 from kaq_private.account_intents where actor_uid=second_uid));
  checked_at:=clock_timestamp();
  update kaq_private.account_intents set created_at=checked_at-interval '16 minutes',expires_at=checked_at-interval '6 minutes'
    where id=(value->>'id')::uuid;
  value:=kaq_private.begin_account_intent('add_existing',gen_random_uuid());
  perform pg_temp.intent_assert('sliding_rate_window_excludes_old_start',
    (select count(*)=6 from kaq_private.account_intents where actor_uid=second_uid) and value?'secret');

  delete from kaq_private.account_intents where actor_uid=second_uid;
  for i in 1..5 loop
    value:=kaq_private.begin_account_intent('add_existing',gen_random_uuid()); checked_at:=clock_timestamp();
    update kaq_private.account_intents set created_at=checked_at-interval '12 minutes',expires_at=checked_at-interval '2 minutes'
      where id=(value->>'id')::uuid;
    if i=1 then
      perform pg_temp.remember_intent(value);
      select to_jsonb(row) into original from kaq_private.account_intents row where id=(value->>'id')::uuid;
      perform pg_temp.intent_expect('wrong_secret_does_not_expire_row',
        'select kaq_private.read_account_intent(current_setting(''intent_probe.id'')::uuid,repeat(''0'',64))','PT404','KAQ_INTENT_NOT_FOUND');
      perform pg_temp.intent_assert('wrong_secret_past_deadline_row_unchanged',original=(
        select to_jsonb(row) from kaq_private.account_intents row where id=(value->>'id')::uuid));
    end if;
    replay:=kaq_private.read_account_intent((value->>'id')::uuid,value->>'secret');
    if replay->>'state'<>'expired' or replay->>'version'<>'1' then raise exception 'Expiry did not settle'; end if;
    replay:=kaq_private.cancel_account_intent((value->>'id')::uuid,value->>'secret',0);
    if replay->>'state'<>'expired' or replay->>'version'<>'1' then raise exception 'Expired intent reopened'; end if;
  end loop;
  perform pg_temp.intent_assert('expiry_is_terminal_once_no_extension',true);
  perform pg_temp.intent_expect('expired_starts_count_toward_rate',
    'select kaq_private.begin_account_intent(''add_existing'',gen_random_uuid())','PT429','KAQ_INTENT_RATE_LIMITED');

  delete from kaq_private.account_intents where actor_uid=second_uid;
  key:=gen_random_uuid();value:=kaq_private.begin_account_intent('add_existing',key);
  update kaq_private.account_intents set state='committed',revision=7 where id=(value->>'id')::uuid;
  receipt_id:=gen_random_uuid();
  insert into kaq_private.account_merge_receipts(id,intent_id,canonical_account_id,algorithm_version,consent_hash,before_scopes,choices,result)
    values(receipt_id,(value->>'id')::uuid,first_uid,1,decode(repeat('ab',32),'hex'),'[]','{}','{}');
  replay:=kaq_private.cancel_account_intent((value->>'id')::uuid,value->>'secret',0);
  perform pg_temp.intent_assert('commit_terminal_not_overwritten',replay->>'state'='committed' and replay->>'version'='7'
    and (replay->>'commit_receipt_id')::uuid=receipt_id);
  replay:=kaq_private.begin_account_intent('add_existing',key);
  perform pg_temp.intent_assert('committed_idempotent_returns_same_receipt',replay->>'state'='committed'
    and (replay->>'commit_receipt_id')::uuid=receipt_id and not(replay?'secret'));

  for function_record in select oid,proname,prosecdef,provolatile,proconfig,proacl,proowner from pg_proc
    where pronamespace='kaq_private'::regnamespace and proname in ('intent_actor_gate','intent_recheck_actor',
      'intent_expire_locked','intent_control_result','intent_control_lock','begin_account_intent','read_account_intent','cancel_account_intent') loop
    perform pg_temp.intent_assert('definer_fixed_path_'||function_record.proname,function_record.prosecdef
      and function_record.provolatile='v' and function_record.proconfig @> array['search_path=pg_catalog, auth, kaq_private, extensions']);
    perform pg_temp.intent_assert('owner_only_acl_'||function_record.proname,not exists(
      select 1 from aclexplode(coalesce(function_record.proacl,acldefault('f',function_record.proowner))) privilege
      where privilege.privilege_type='EXECUTE' and privilege.grantee<>function_record.proowner));
    foreach role_name in array array['anon','authenticated','service_role'] loop
      perform pg_temp.intent_assert('execute_denied_'||function_record.proname||'_'||role_name,
        not has_function_privilege(role_name,function_record.oid,'EXECUTE'));
    end loop;
  end loop;
end $$;
select json_build_object('status','passed','checks',json_agg(name order by name)) from intent_checks;
rollback;
