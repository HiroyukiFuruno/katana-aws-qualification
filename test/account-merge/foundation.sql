begin;
create temporary table foundation_checks (name text primary key) on commit drop;
create function pg_temp.check_foundation(label text, passed boolean) returns void language plpgsql as $$
begin
  if passed is distinct from true then raise exception 'Foundation assertion failed: %', label; end if;
  insert into foundation_checks values (label);
end $$;
create function pg_temp.reject_foundation(label text, statement text, expected text) returns void language plpgsql as $$
declare actual text;
begin
  begin
    execute statement;
  exception when others then
    get stacked diagnostics actual = returned_sqlstate;
    if actual <> expected then raise exception 'Foundation % expected SQLSTATE %, received %', label, expected, actual; end if;
    perform pg_temp.check_foundation(label, true);
    return;
  end;
  raise exception 'Foundation accepted invalid input: %', label;
end $$;
create function pg_temp.reject_patch(label text, relation text, patch jsonb, expected text default '23514')
returns void language plpgsql as $$
declare original jsonb;
begin
  execute format('select to_jsonb(row) from kaq_private.%I row limit 1', relation) into strict original;
  perform pg_temp.reject_foundation(label, format(
    'insert into kaq_private.%1$I select * from jsonb_populate_record(null::kaq_private.%1$I, %2$L::jsonb)',
    relation, original || patch), expected);
end $$;
create function pg_temp.check_private_acl() returns void language plpgsql as $$
declare relation record; role_name text; count_tables integer := 0;
begin
  foreach role_name in array array['anon', 'authenticated', 'service_role'] loop
    perform pg_temp.check_foundation('schema_denied_' || role_name,
      not has_schema_privilege(role_name, 'kaq_private', 'USAGE, CREATE'));
  end loop;
  for relation in select oid, relname, relrowsecurity from pg_class
    where relnamespace = 'kaq_private'::regnamespace and relkind = 'r' order by relname loop
    count_tables := count_tables + 1;
    perform pg_temp.check_foundation('rls_' || relation.relname, relation.relrowsecurity);
    execute format('select pg_temp.check_foundation(%L, not exists(select 1 from kaq_private.%I))',
      'empty_' || relation.relname, relation.relname);
    foreach role_name in array array['anon', 'authenticated', 'service_role'] loop
      perform pg_temp.check_foundation('table_denied_' || role_name || '_' || relation.relname,
        not has_table_privilege(role_name, relation.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER'));
      begin
        execute format('set local role %I', role_name);
        execute format('select 1 from kaq_private.%I limit 0', relation.relname);
        raise exception 'Private read allowed';
      exception when insufficient_privilege then null;
      end;
      perform pg_temp.check_foundation('actual_read_denied_' || role_name || '_' || relation.relname, true);
    end loop;
  end loop;
  perform pg_temp.check_foundation('ten_private_tables', count_tables = 10);
  perform pg_temp.check_foundation('no_private_rpc', not exists(
    select 1 from pg_proc where pronamespace = 'kaq_private'::regnamespace));
  perform pg_temp.check_foundation('no_private_policies', not exists(
    select 1 from pg_policies where schemaname = 'kaq_private'));
end $$;
select pg_temp.check_private_acl();
do $$
declare
  first_uid uuid := '__FIRST_USER__'; second_uid uuid := '__SECOND_USER__';
  first_session uuid := '__FIRST_SESSION__'; second_session uuid := '__SECOND_SESSION__';
  source_account uuid := gen_random_uuid(); target_account uuid := gen_random_uuid();
  first_intent uuid := gen_random_uuid(); second_intent uuid := gen_random_uuid();
  first_leg uuid := gen_random_uuid(); second_leg uuid := gen_random_uuid(); other_leg uuid := gen_random_uuid();
  receipt uuid := gen_random_uuid(); digest bytea := decode(repeat('ab', 32), 'hex');
  relation record; canonical_before jsonb;
begin
  perform pg_temp.check_foundation('real_first_session', exists(
    select 1 from auth.sessions where id = first_session and user_id = first_uid));
  perform pg_temp.check_foundation('real_second_session', exists(
    select 1 from auth.sessions where id = second_session and user_id = second_uid));
  insert into kaq_private.learning_accounts(id) values(source_account), (target_account);
  insert into kaq_private.learning_memberships(auth_user_id, account_id)
    values(first_uid, source_account), (second_uid, target_account);
  insert into kaq_private.learning_session_grants(session_id, auth_user_id, account_id, membership_epoch, reason)
    values(first_session, first_uid, source_account, 0, 'proof'), (second_session, second_uid, target_account, 0, 'proof');
  insert into kaq_private.account_intents(id, kind, actor_uid, actor_session_id, secret_hash,
    source_account_id, source_membership_epoch, expires_at)
    values(first_intent, 'merge_existing', first_uid, first_session, digest, source_account, 0, clock_timestamp() + interval '9 minutes'),
      (second_intent, 'merge_existing', second_uid, second_session, digest, target_account, 0, clock_timestamp() + interval '9 minutes');
  update kaq_private.account_intents set target_uid = case when id = first_intent then second_uid else first_uid end,
    target_account_id = case when id = first_intent then target_account else source_account end, target_membership_epoch = 0;
  insert into kaq_private.account_proof_legs(id, intent_id, side, attempt, expected_uid, storage_key, ingest_nonce_hash, expires_at)
    values(first_leg, first_intent, 'source', 1, first_uid, 'foundation:first', digest, clock_timestamp() + interval '2 minutes'),
      (second_leg, first_intent, 'target', 1, second_uid, 'foundation:second', digest, clock_timestamp() + interval '2 minutes'),
      (other_leg, second_intent, 'source', 1, second_uid, 'foundation:other', digest, clock_timestamp() + interval '2 minutes');
  insert into kaq_private.account_proof_runtime(leg_id, encryption_key_version, nonce, ciphertext, expires_at)
    values(first_leg, 'test-v1', decode(repeat('cd', 12), 'hex'), decode(repeat('ef', 16), 'hex'), clock_timestamp() + interval '2 minutes');
  insert into kaq_private.account_proofs(intent_id, leg_id, auth_uid, session_id, session_created_at, oauth_at,
    account_id, membership_epoch, expires_at)
    select first_intent, leg.id, session.user_id, session.id, session.created_at, amr.updated_at,
      membership.account_id, membership.epoch, clock_timestamp() + interval '9 minutes'
    from auth.sessions session join auth.mfa_amr_claims amr on amr.session_id = session.id
    join kaq_private.learning_memberships membership on membership.auth_user_id = session.user_id
    join kaq_private.account_proof_legs leg on leg.id = case when session.id = first_session then first_leg else second_leg end
    where session.id in (first_session, second_session) and amr.authentication_method = 'oauth';
  insert into kaq_private.account_merge_receipts(id, intent_id, canonical_account_id, algorithm_version,
    consent_hash, before_scopes, choices, result) values(receipt, first_intent, target_account, 1, digest, '[]', '{}', '{}');
  insert into kaq_private.account_merge_archives(receipt_id, canonical_account_id, origin_account_id,
    table_name, row_key, row_key_hash, payload, payload_hash)
    values(receipt, target_account, source_account, 'learning_state', '{}', digest, '{}', digest);
  insert into kaq_private.account_merge_id_maps(receipt_id, canonical_account_id, origin_account_id,
    entity_kind, original_id, canonical_id, original_row_hash, canonical_row_hash)
    values(receipt, target_account, source_account, 'event', gen_random_uuid(), gen_random_uuid(), digest, digest);
  for relation in select relname from pg_class where relnamespace = 'kaq_private'::regnamespace and relkind = 'r' loop
    execute format('select pg_temp.check_foundation(%L, exists(select 1 from kaq_private.%I))',
      'valid_record_' || relation.relname, relation.relname);
  end loop;
  for relation in select constraint_record.conname, table_record.relname, attribute_record.attname
    from pg_constraint constraint_record
    join pg_class table_record on table_record.oid = constraint_record.conrelid
    join pg_attribute attribute_record on attribute_record.attrelid = constraint_record.conrelid
      and attribute_record.attnum = constraint_record.conkey[1]
    where constraint_record.contype = 'f' and table_record.relnamespace = 'kaq_private'::regnamespace loop
    perform pg_temp.reject_foundation('fk_' || relation.conname, format(
      'update kaq_private.%I set %I = %L where ctid = (select ctid from kaq_private.%I limit 1)',
      relation.relname, relation.attname, gen_random_uuid(), relation.relname), '23503');
  end loop;
  perform pg_temp.reject_patch('account_status_check', 'learning_accounts', '{"status":"invalid"}');
  perform pg_temp.reject_patch('account_revision_check', 'learning_accounts', '{"membership_revision":-1}');
  perform pg_temp.reject_patch('retired_timestamp_check', 'learning_accounts', '{"status":"retired","retired_at":null}');
  perform pg_temp.reject_patch('membership_epoch_check', 'learning_memberships', '{"epoch":-1}');
  perform pg_temp.reject_patch('membership_status_check', 'learning_memberships', '{"status":"invalid"}');
  perform pg_temp.reject_foundation('membership_auth_fk', format(
    'update kaq_private.learning_memberships set auth_user_id = %L where auth_user_id = %L', gen_random_uuid(), first_uid), '23503');
  perform pg_temp.reject_foundation('membership_account_fk', format(
    'update kaq_private.learning_memberships set account_id = %L where auth_user_id = %L', gen_random_uuid(), first_uid), '23503');
  perform pg_temp.reject_patch('membership_uid_unique', 'learning_memberships', '{}', '23505');
  perform pg_temp.reject_patch('grant_reason_check', 'learning_session_grants', '{"reason":"invalid"}');
  perform pg_temp.reject_patch('grant_epoch_check', 'learning_session_grants', '{"membership_epoch":-1}');
  perform pg_temp.reject_foundation('grant_session_fk', format(
    'update kaq_private.learning_session_grants set session_id = %L where session_id = %L', gen_random_uuid(), first_session), '23503');
  perform pg_temp.reject_patch('intent_secret_32', 'account_intents', '{"secret_hash":"\\x01"}');
  perform pg_temp.reject_patch('intent_kind_check', 'account_intents', '{"kind":"create_new"}');
  perform pg_temp.reject_patch('intent_revision_check', 'account_intents', '{"revision":-1}');
  perform pg_temp.reject_patch('intent_expiry_check', 'account_intents', jsonb_build_object('expires_at', clock_timestamp() + interval '11 minutes'));
  perform pg_temp.reject_patch('intent_actor_target_check', 'account_intents', jsonb_build_object(
    'actor_uid', first_uid, 'target_uid', first_uid, 'target_account_id', source_account, 'target_membership_epoch', 0));
  perform pg_temp.reject_patch('intent_preview_bundle_check', 'account_intents', '{"state":"previewed"}');
  perform pg_temp.reject_foundation('active_intent_unique', format(
    'insert into kaq_private.account_intents(kind, actor_uid, actor_session_id, secret_hash, source_account_id,
    source_membership_epoch, expires_at) values(''merge_existing'', %L, %L, %L, %L, 0, clock_timestamp() + interval ''9 minutes'')',
    first_uid, first_session, digest, source_account), '23505');
  update kaq_private.account_intents set state = 'cancelled' where id = second_intent;
  insert into kaq_private.account_intents(kind, actor_uid, actor_session_id, secret_hash, source_account_id, source_membership_epoch, expires_at)
    values('merge_existing', second_uid, second_session, digest, target_account, 0, clock_timestamp() + interval '9 minutes');
  perform pg_temp.check_foundation('cancelled_intent_replacement', true);
  perform pg_temp.reject_patch('leg_attempt_zero_check', 'account_proof_legs', '{"attempt":0}');
  perform pg_temp.reject_patch('leg_attempt_four_check', 'account_proof_legs', '{"attempt":4}');
  perform pg_temp.reject_patch('leg_nonce_32', 'account_proof_legs', '{"ingest_nonce_hash":"\\x01"}');
  perform pg_temp.reject_patch('leg_side_check', 'account_proof_legs', '{"side":"invalid"}');
  perform pg_temp.reject_patch('leg_state_check', 'account_proof_legs', '{"state":"invalid"}');
  perform pg_temp.reject_patch('leg_storage_key_check', 'account_proof_legs', '{"storage_key":""}');
  perform pg_temp.reject_patch('leg_ttl_check', 'account_proof_legs', jsonb_build_object('expires_at', clock_timestamp() + interval '4 minutes'));
  perform pg_temp.reject_patch('leg_storage_unique', 'account_proof_legs', jsonb_build_object('id', gen_random_uuid(), 'attempt', 2), '23505');
  perform pg_temp.reject_patch('leg_side_attempt_unique', 'account_proof_legs', jsonb_build_object('id', gen_random_uuid(), 'storage_key', 'foundation:duplicate'), '23505');
  insert into kaq_private.account_proof_legs(intent_id, side, attempt, expected_uid, storage_key, ingest_nonce_hash, expires_at)
    values(first_intent, 'source', 2, first_uid, 'foundation:attempt2', digest, clock_timestamp() + interval '2 minutes'),
      (first_intent, 'source', 3, first_uid, 'foundation:attempt3', digest, clock_timestamp() + interval '2 minutes');
  perform pg_temp.check_foundation('leg_attempts_two_three_valid', true);
  perform pg_temp.reject_patch('runtime_nonce_12', 'account_proof_runtime', '{"nonce":"\\x01"}');
  perform pg_temp.reject_patch('runtime_ciphertext_16', 'account_proof_runtime', '{"ciphertext":"\\x01"}');
  perform pg_temp.reject_patch('runtime_key_version_check', 'account_proof_runtime', '{"encryption_key_version":""}');
  perform pg_temp.reject_patch('runtime_ttl_check', 'account_proof_runtime', jsonb_build_object('expires_at', clock_timestamp() + interval '11 minutes'));
  perform pg_temp.reject_foundation('proof_cross_intent_leg_fk', format(
    'update kaq_private.account_proofs set intent_id = %L where leg_id = %L', second_intent, first_leg), '23503');
  perform pg_temp.reject_foundation('proof_session_one_use', format(
    'update kaq_private.account_proofs set session_id = %L where leg_id = %L', first_session, second_leg), '23505');
  perform pg_temp.reject_patch('proof_owner_epoch_check', 'account_proofs', '{"membership_epoch":null}');
  perform pg_temp.reject_patch('proof_expiry_check', 'account_proofs', jsonb_build_object('expires_at', clock_timestamp() - interval '1 day'));
  perform pg_temp.reject_patch('receipt_intent_one_use', 'account_merge_receipts', jsonb_build_object('id', gen_random_uuid()), '23505');
  perform pg_temp.reject_patch('receipt_algorithm_check', 'account_merge_receipts', '{"algorithm_version":0}');
  perform pg_temp.reject_patch('receipt_consent_32', 'account_merge_receipts', '{"consent_hash":"\\x01"}');
  perform pg_temp.reject_patch('receipt_scopes_array_check', 'account_merge_receipts', '{"before_scopes":{}}');
  perform pg_temp.reject_patch('receipt_choices_object_check', 'account_merge_receipts', '{"choices":[]}');
  perform pg_temp.reject_patch('archive_table_check', 'account_merge_archives', '{"table_name":"auth.users"}');
  perform pg_temp.reject_patch('archive_payload_object_check', 'account_merge_archives', '{"payload":[]}');
  perform pg_temp.reject_patch('archive_hash_32', 'account_merge_archives', '{"payload_hash":"\\x01"}');
  perform pg_temp.reject_patch('archive_origin_row_unique', 'account_merge_archives', jsonb_build_object('id', gen_random_uuid()), '23505');
  perform pg_temp.reject_patch('idmap_entity_check', 'account_merge_id_maps', '{"entity_kind":"invalid"}');
  perform pg_temp.reject_patch('idmap_hash_32', 'account_merge_id_maps', '{"canonical_row_hash":"\\x01"}');
  perform pg_temp.reject_patch('idmap_origin_entity_unique', 'account_merge_id_maps', '{}', '23505');
  update kaq_private.learning_memberships set epoch = 1 where auth_user_id = first_uid;
  perform pg_temp.check_foundation('epoch_change_does_not_upgrade_old_grant', exists(
    select 1 from kaq_private.learning_session_grants where session_id = first_session and membership_epoch = 0));
  select jsonb_agg(to_jsonb(account) order by id) into canonical_before from kaq_private.learning_accounts account;
  delete from auth.users where id = first_uid;
  perform pg_temp.check_foundation('auth_delete_preserves_account_contents', canonical_before = (
    select jsonb_agg(to_jsonb(account) order by id) from kaq_private.learning_accounts account));
  perform pg_temp.check_foundation('auth_delete_cascades_membership', not exists(
    select 1 from kaq_private.learning_memberships where auth_user_id = first_uid));
  perform pg_temp.check_foundation('auth_delete_cascades_session_grant', not exists(
    select 1 from kaq_private.learning_session_grants where auth_user_id = first_uid));
  perform pg_temp.check_foundation('auth_delete_preserves_both_accounts', (
    select count(*) = 2 from kaq_private.learning_accounts where id in (source_account, target_account)));
  perform pg_temp.check_foundation('auth_delete_preserves_other_membership', exists(
    select 1 from kaq_private.learning_memberships where auth_user_id = second_uid and account_id = target_account));
  perform pg_temp.check_foundation('auth_delete_preserves_receipt_archive_proof',
    exists(select 1 from kaq_private.account_merge_receipts where id = receipt)
    and exists(select 1 from kaq_private.account_merge_archives where receipt_id = receipt)
    and (select count(*) = 2 from kaq_private.account_proofs where intent_id = first_intent));
end $$;
select json_build_object('status', 'passed', 'checks', json_agg(name order by name)) from foundation_checks;
rollback;
