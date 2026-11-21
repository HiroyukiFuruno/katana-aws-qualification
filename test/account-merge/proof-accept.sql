-- 固定GUCはSQL helperの負例だけであり、PostgREST署名/audienceや実OIDC正例の代用ではない。
begin;
create temporary table proof_accept_checks(name text primary key) on commit drop;
create function pg_temp.proof_accept_assert(label text, passed boolean) returns void language plpgsql as $$
begin
  if passed is distinct from true then raise exception 'proof accept assertion failed: %', label; end if;
  insert into proof_accept_checks values(label);
end $$;
create function pg_temp.proof_accept_expect(label text, statement text, expected text, expected_state text default null) returns void language plpgsql as $$
declare actual text; actual_state text;
begin
  begin execute statement; raise exception 'proof accept accepted invalid case: %', label;
  exception when others then
    get stacked diagnostics actual = message_text, actual_state = returned_sqlstate;
    if actual <> expected then raise exception 'proof accept % expected %, got %', label, expected, actual; end if;
    if expected_state is not null and actual_state <> expected_state then
      raise exception 'proof accept % expected SQLSTATE %, got %', label, expected_state, actual_state;
    end if;
  end;
  perform pg_temp.proof_accept_assert(label, true);
end $$;
create function pg_temp.proof_accept_claims(claims jsonb) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', claims::text, true);
  perform set_config('request.headers', '{}', true);
end $$;
create function pg_temp.proof_accept_expect_context(label text, claims jsonb, intent_id uuid, leg_id uuid) returns void language plpgsql as $$
begin
  perform pg_temp.proof_accept_claims(claims);
  perform pg_temp.proof_accept_expect(label,
    format('select kaq_private.accept_account_proof(%L,%L,decode(repeat(''ab'',32),''hex''),0)', intent_id, leg_id),
    'KAQ_PROOF_AUTH_CONTEXT_INVALID', '28000');
end $$;
create function pg_temp.proof_accept_snapshot() returns jsonb language sql as $$
  select jsonb_build_object(
    'intents', coalesce((select jsonb_agg(to_jsonb(i) order by i.id) from kaq_private.account_intents i), '[]'::jsonb),
    'legs', coalesce((select jsonb_agg(to_jsonb(l) order by l.id) from kaq_private.account_proof_legs l), '[]'::jsonb),
    'proofs', coalesce((select jsonb_agg(to_jsonb(p) order by p.id) from kaq_private.account_proofs p), '[]'::jsonb)
  )
$$;
do $$
declare
  actor_uid uuid := '__FIRST_USER__'; actor_session uuid := '__FIRST_SESSION__'; target_auth_uid uuid := '__SECOND_USER__';
  source_account uuid := gen_random_uuid(); intent_id uuid := gen_random_uuid(); leg_id uuid := gen_random_uuid();
  target_intent uuid := gen_random_uuid(); proof_intent uuid := gen_random_uuid(); proof_leg_one uuid := gen_random_uuid();
  proof_leg_two uuid := gen_random_uuid(); nonce bytea := decode(repeat('ab', 32), 'hex'); issuer text; claims jsonb;
  before jsonb; settings jsonb;
begin
  select auth_issuer into strict issuer from kaq_private.account_protocol_settings where id;
  perform pg_temp.proof_accept_assert('settings_singleton', (select count(*) = 1 from kaq_private.account_protocol_settings));
  perform pg_temp.proof_accept_assert('settings_rls_and_acl',
    (select relrowsecurity from pg_class where oid = 'kaq_private.account_protocol_settings'::regclass)
    and not has_table_privilege('anon', 'kaq_private.account_protocol_settings', 'SELECT,INSERT,UPDATE,DELETE')
    and not has_table_privilege('authenticated', 'kaq_private.account_protocol_settings', 'SELECT,INSERT,UPDATE,DELETE')
    and not has_table_privilege('service_role', 'kaq_private.account_protocol_settings', 'SELECT,INSERT,UPDATE,DELETE'));
  perform pg_temp.proof_accept_assert('private_helpers_closed',
    not has_function_privilege('anon', 'kaq_private.accept_account_proof(uuid,uuid,bytea,bigint)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'kaq_private.accept_account_proof(uuid,uuid,bytea,bigint)', 'EXECUTE')
    and not has_function_privilege('service_role', 'kaq_private.accept_account_proof(uuid,uuid,bytea,bigint)', 'EXECUTE'));

  insert into kaq_private.learning_accounts(id) values(source_account);
  insert into kaq_private.account_intents(id, kind, actor_uid, actor_session_id, secret_hash,
    source_account_id, source_membership_epoch, expires_at, state, target_uid)
    values(target_intent, 'merge_existing', actor_uid, actor_session, decode(repeat('11', 32), 'hex'),
      source_account, 0, clock_timestamp() + interval '9 minutes', 'both_proved', target_auth_uid);
  perform pg_temp.proof_accept_assert('merge_target_uid_only_terminal_allowed', exists(
    select 1 from kaq_private.account_intents i where i.id = target_intent and i.target_uid = target_auth_uid
      and target_account_id is null and target_membership_epoch is null));
  perform pg_temp.proof_accept_expect('add_existing_target_uid_only_rejected', format(
    'insert into kaq_private.account_intents(id,kind,actor_uid,actor_session_id,secret_hash,expires_at,target_uid) values(%L,''add_existing'',%L,%L,decode(repeat(''12'',32),''hex''),clock_timestamp()+interval ''9 minutes'',%L)',
    gen_random_uuid(), actor_uid, actor_session, target_auth_uid), 'new row for relation "account_intents" violates check constraint "account_intents_target_snapshot_check"');
  perform pg_temp.proof_accept_expect('merge_target_uid_only_before_proof_rejected', format(
    'insert into kaq_private.account_intents(id,kind,actor_uid,actor_session_id,secret_hash,source_account_id,source_membership_epoch,expires_at,state,target_uid) values(%L,''merge_existing'',%L,%L,decode(repeat(''13'',32),''hex''),%L,0,clock_timestamp()+interval ''9 minutes'',''awaiting_target'',%L)',
    gen_random_uuid(), actor_uid, actor_session, source_account, target_auth_uid), 'new row for relation "account_intents" violates check constraint "account_intents_target_snapshot_check"');
  update kaq_private.account_intents set state = 'cancelled' where id = target_intent;

  insert into kaq_private.account_intents(id, kind, actor_uid, actor_session_id, secret_hash,
    source_account_id, source_membership_epoch, expires_at)
    values(proof_intent, 'merge_existing', actor_uid, actor_session, decode(repeat('14', 32), 'hex'), source_account, 0,
      clock_timestamp() + interval '9 minutes');
  insert into kaq_private.account_proof_legs(id, intent_id, side, attempt, storage_key, ingest_nonce_hash, expires_at)
    values(proof_leg_one, proof_intent, 'source', 1, 'proof-accept-schema-one:' || proof_intent, nonce, clock_timestamp() + interval '2 minutes'),
      (proof_leg_two, proof_intent, 'target', 1, 'proof-accept-schema-two:' || proof_intent, nonce, clock_timestamp() + interval '2 minutes');
  insert into kaq_private.account_proofs(intent_id, leg_id, auth_uid, session_id, session_created_at, oauth_at, expires_at)
    values(proof_intent, proof_leg_one, target_auth_uid, gen_random_uuid(), clock_timestamp(), clock_timestamp(), clock_timestamp() + interval '9 minutes');
  perform pg_temp.proof_accept_expect('proof_snapshot_partial_rejected', format(
    'insert into kaq_private.account_proofs(intent_id,leg_id,auth_uid,session_id,session_created_at,oauth_at,account_id,expires_at) values(%L,%L,%L,%L,clock_timestamp(),clock_timestamp(),%L,clock_timestamp()+interval ''9 minutes'')',
    proof_intent, proof_leg_two, actor_uid, gen_random_uuid(), source_account),
    'new row for relation "account_proofs" violates check constraint "account_proofs_membership_snapshot_check"');
  perform pg_temp.proof_accept_expect('proof_same_intent_uid_rejected', format(
    'insert into kaq_private.account_proofs(intent_id,leg_id,auth_uid,session_id,session_created_at,oauth_at,expires_at) values(%L,%L,%L,%L,clock_timestamp(),clock_timestamp(),clock_timestamp()+interval ''9 minutes'')',
    proof_intent, proof_leg_two, target_auth_uid, gen_random_uuid()), 'duplicate key value violates unique constraint "account_proofs_intent_auth_uid_unique"');
  update kaq_private.account_intents set state = 'cancelled' where id = proof_intent;

  insert into kaq_private.account_intents(id, kind, actor_uid, actor_session_id, secret_hash,
    source_account_id, source_membership_epoch, expires_at)
    values(intent_id, 'merge_existing', actor_uid, actor_session, decode(repeat('15', 32), 'hex'), source_account, 0,
      clock_timestamp() + interval '9 minutes');
  insert into kaq_private.account_proof_legs(id, intent_id, side, attempt, expected_uid, storage_key, ingest_nonce_hash,
    state, issued_at, expires_at)
    values(leg_id, intent_id, 'source', 1, actor_uid, 'proof-accept-negative:' || intent_id,
      extensions.digest(nonce, 'sha256'), 'exchanged', clock_timestamp() - interval '1 second', clock_timestamp() + interval '2 minutes');
  claims := jsonb_build_object('sub', actor_uid, 'session_id', actor_session, 'iss', issuer, 'role', 'authenticated',
    'aud', 'authenticated', 'exp', floor(extract(epoch from clock_timestamp())) + 3600,
    'amr', jsonb_build_array(jsonb_build_object('method', 'oauth', 'timestamp', floor(extract(epoch from clock_timestamp())))));
  before := pg_temp.proof_accept_snapshot();
  perform pg_temp.proof_accept_claims(claims - 'iss');
  perform pg_temp.proof_accept_expect('missing_issuer_guc_negative', format(
    'select kaq_private.accept_account_proof(%L,%L,decode(repeat(''ab'',32),''hex''),0)', intent_id, leg_id), 'KAQ_PROOF_AUTH_CONTEXT_INVALID', '28000');
  perform pg_temp.proof_accept_claims(claims || jsonb_build_object('iss', 'https://wrong.example.test/auth/v1'));
  perform pg_temp.proof_accept_expect('issuer_mismatch_guc_negative', format(
    'select kaq_private.accept_account_proof(%L,%L,decode(repeat(''ab'',32),''hex''),0)', intent_id, leg_id), 'KAQ_PROOF_AUTH_CONTEXT_INVALID', '28000');
  perform pg_temp.proof_accept_claims(claims || jsonb_build_object('aud', jsonb_build_array()));
  perform pg_temp.proof_accept_expect('empty_audience_guc_negative', format(
    'select kaq_private.accept_account_proof(%L,%L,decode(repeat(''ab'',32),''hex''),0)', intent_id, leg_id), 'KAQ_PROOF_AUTH_CONTEXT_INVALID', '28000');
  perform pg_temp.proof_accept_claims(claims || jsonb_build_object('role', 'service_role'));
  perform pg_temp.proof_accept_expect('role_guc_negative', format(
    'select kaq_private.accept_account_proof(%L,%L,decode(repeat(''ab'',32),''hex''),0)', intent_id, leg_id), 'KAQ_PROOF_AUTH_CONTEXT_INVALID', '28000');
  perform pg_temp.proof_accept_claims(claims || jsonb_build_object('exp', floor(extract(epoch from clock_timestamp())) - 1));
  perform pg_temp.proof_accept_expect('expired_claim_guc_negative', format(
    'select kaq_private.accept_account_proof(%L,%L,decode(repeat(''ab'',32),''hex''),0)', intent_id, leg_id), 'KAQ_PROOF_AUTH_CONTEXT_INVALID', '28000');
  perform pg_temp.proof_accept_expect_context('missing_sub_claim', claims - 'sub', intent_id, leg_id);
  perform pg_temp.proof_accept_expect_context('null_sub_claim', claims || jsonb_build_object('sub', null), intent_id, leg_id);
  perform pg_temp.proof_accept_expect_context('invalid_sub_type', claims || jsonb_build_object('sub', 42), intent_id, leg_id);
  perform pg_temp.proof_accept_expect_context('invalid_sub_uuid', claims || jsonb_build_object('sub', 'not-a-uuid'), intent_id, leg_id);
  perform pg_temp.proof_accept_expect_context('zero_sub_uuid', claims || jsonb_build_object('sub', '00000000-0000-0000-0000-000000000000'), intent_id, leg_id);
  perform pg_temp.proof_accept_expect_context('missing_session_id_claim', claims - 'session_id', intent_id, leg_id);
  perform pg_temp.proof_accept_expect_context('null_session_id_claim', claims || jsonb_build_object('session_id', null), intent_id, leg_id);
  perform pg_temp.proof_accept_expect_context('invalid_session_id_type', claims || jsonb_build_object('session_id', 42), intent_id, leg_id);
  perform pg_temp.proof_accept_expect_context('invalid_session_id_uuid', claims || jsonb_build_object('session_id', 'not-a-uuid'), intent_id, leg_id);
  perform pg_temp.proof_accept_expect_context('zero_session_id_uuid', claims || jsonb_build_object('session_id', '00000000-0000-0000-0000-000000000000'), intent_id, leg_id);
  perform pg_temp.proof_accept_expect_context('missing_issuer_claim', claims - 'iss', intent_id, leg_id);
  perform pg_temp.proof_accept_expect_context('null_issuer_claim', claims || jsonb_build_object('iss', null), intent_id, leg_id);
  perform pg_temp.proof_accept_expect_context('invalid_issuer_type', claims || jsonb_build_object('iss', 42), intent_id, leg_id);
  perform pg_temp.proof_accept_expect_context('missing_role_claim', claims - 'role', intent_id, leg_id);
  perform pg_temp.proof_accept_expect_context('null_role_claim', claims || jsonb_build_object('role', null), intent_id, leg_id);
  perform pg_temp.proof_accept_expect_context('invalid_role_type', claims || jsonb_build_object('role', 42), intent_id, leg_id);
  perform pg_temp.proof_accept_expect_context('missing_audience_claim', claims - 'aud', intent_id, leg_id);
  perform pg_temp.proof_accept_expect_context('null_audience_claim', claims || jsonb_build_object('aud', null), intent_id, leg_id);
  perform pg_temp.proof_accept_expect_context('empty_audience_string', claims || jsonb_build_object('aud', ''), intent_id, leg_id);
  perform pg_temp.proof_accept_expect_context('mixed_audience_array', claims || jsonb_build_object('aud', jsonb_build_array('authenticated', 'other')), intent_id, leg_id);
  perform pg_temp.proof_accept_expect_context('invalid_audience_type', claims || jsonb_build_object('aud', 42), intent_id, leg_id);
  perform pg_temp.proof_accept_expect_context('missing_exp_claim', claims - 'exp', intent_id, leg_id);
  perform pg_temp.proof_accept_expect_context('null_exp_claim', claims || jsonb_build_object('exp', null), intent_id, leg_id);
  perform pg_temp.proof_accept_expect_context('string_exp_claim', claims || jsonb_build_object('exp', 'not-number'), intent_id, leg_id);
  perform pg_temp.proof_accept_expect_context('decimal_exp_claim', claims || jsonb_build_object('exp', floor(extract(epoch from clock_timestamp())) + 0.5), intent_id, leg_id);
  perform pg_temp.proof_accept_expect_context('overflow_exp_claim', claims || jsonb_build_object('exp', 900719925474099999999999), intent_id, leg_id);
  perform pg_temp.proof_accept_claims(claims);
  perform pg_temp.proof_accept_assert('scalar_audience_context_positive',
    kaq_private.proof_claim_context() = jsonb_build_object('uid', actor_uid, 'session_id', actor_session));
  perform pg_temp.proof_accept_claims(claims || jsonb_build_object('aud', jsonb_build_array('authenticated')));
  perform pg_temp.proof_accept_assert('array_audience_context_positive',
    kaq_private.proof_claim_context() = jsonb_build_object('uid', actor_uid, 'session_id', actor_session));
  perform pg_temp.proof_accept_claims(claims);
  perform pg_temp.proof_accept_expect('nonce_mismatch_zero_change', format(
    'select kaq_private.accept_account_proof(%L,%L,decode(repeat(''ff'',32),''hex''),0)', intent_id, leg_id), 'KAQ_PROOF_NONCE_INVALID');
  perform pg_temp.proof_accept_expect('main_session_cannot_be_proof', format(
    'select kaq_private.accept_account_proof(%L,%L,decode(repeat(''ab'',32),''hex''),0)', intent_id, leg_id), 'KAQ_PROOF_SESSION_REUSED');
  perform pg_temp.proof_accept_assert('fixed_guc_negatives_preserve_rows', before = pg_temp.proof_accept_snapshot());

  settings := to_jsonb((select s from kaq_private.account_protocol_settings s where id));
  delete from kaq_private.account_protocol_settings where id;
  perform pg_temp.proof_accept_expect('missing_owner_config_fails_closed', 'select kaq_private.proof_claim_context()', 'KAQ_PROOF_AUTH_CONTEXT_INVALID');
  insert into kaq_private.account_protocol_settings select * from jsonb_populate_record(null::kaq_private.account_protocol_settings, settings);
end $$;
select jsonb_build_object('status', 'passed', 'checks', (select jsonb_agg(name order by name) from proof_accept_checks),
  'checkCount', (select count(*) from proof_accept_checks), 'fixedGucNegativesOnly', true);
rollback;
