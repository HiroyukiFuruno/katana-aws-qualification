-- 実GoTrue password loginの3 user/sessionを親runnerが置換する。署名検証/OAuth二者proof自体は対象外。
begin;
create temporary table locking_scope_checks(name text primary key) on commit drop;
create temporary table locking_scope_snapshot(schema_name text, relation text, contents jsonb) on commit drop;
create function pg_temp.check_lock_scope(label text, passed boolean) returns void language plpgsql as $$
begin
  if passed is distinct from true then raise exception 'Locking scope assertion failed: %', label; end if;
  insert into locking_scope_checks values(label);
end $$;
create function pg_temp.case_lock_scope(
  label text, statement text, expected_state text default 'PT403', expected_message text default 'KAQ_SCOPE_INVALID',
  mode text default 'writer', generation bigint default 0, targets uuid[] default null,
  sessions uuid[] default '{}', accepted boolean default false, expected_constraint text default null
) returns void language plpgsql as $$
declare result jsonb; actual_state text; actual_message text; actual_constraint text; constraint_rejected boolean := false;
begin
  begin
    begin
      execute statement;
    exception when foreign_key_violation or check_violation then
      get stacked diagnostics actual_state = returned_sqlstate, actual_constraint = constraint_name;
      if expected_constraint is null or actual_state <> expected_state or actual_constraint <> expected_constraint then
        raise exception 'Locking scope % expected %/constraint %, received %/%', label,
          expected_state, expected_constraint, actual_state, actual_constraint;
      end if;
      constraint_rejected := true;
    end;
    if not constraint_rejected then
      if expected_constraint is not null then raise exception 'Locking scope mutation accepted invalid input: %', label; end if;
      if accepted then
        result := kaq_private.lock_learning_scope(mode, generation, targets, sessions);
        if result ->> 'state_mode' is distinct from mode
          or (result ->> 'generation')::bigint is distinct from generation then
          raise exception 'Unexpected locking context: %', result;
        end if;
      else
        begin
          perform kaq_private.lock_learning_scope(mode, generation, targets, sessions);
          raise exception 'Locking scope accepted invalid input: %', label;
        exception when others then
          get stacked diagnostics actual_state = returned_sqlstate, actual_message = message_text;
          if actual_state <> expected_state or actual_message <> expected_message then
            raise exception 'Locking scope % expected %/%, received %/%', label,
              expected_state, expected_message, actual_state, actual_message;
          end if;
        end;
      end if;
    end if;
    -- 成功caseも全lockと一時変更を解放し、次のcaseでlock upgradeを発生させない。
    raise sqlstate 'ZX001';
  exception when sqlstate 'ZX001' then null;
  end;
  perform pg_temp.check_lock_scope(label, true);
end $$;
do $$
declare
  first_uid uuid := '__FIRST_USER__'; second_uid uuid := '__SECOND_USER__'; third_uid uuid := '__THIRD_USER__';
  first_session uuid := '__FIRST_SESSION__'; second_session uuid := '__SECOND_SESSION__'; third_session uuid := '__THIRD_SESSION__';
  claims jsonb; headers jsonb; case_record record; relation_record record; contents_after jsonb;
  grant_update text; account_update text; member_update text; role_name text; function_record record;
  has_grant_member_account_fk boolean;
begin
  select exists(select 1 from pg_constraint
    where conrelid = 'kaq_private.learning_session_grants'::regclass
      and conname = 'learning_session_grants_member_account_fkey' and contype = 'f') into has_grant_member_account_fk;
  perform pg_temp.check_lock_scope('three_real_gotrue_sessions', (
    select count(*) = 3 from auth.sessions session join auth.mfa_amr_claims amr on amr.session_id = session.id
    where ((session.id = first_session and session.user_id = first_uid)
      or (session.id = second_session and session.user_id = second_uid)
      or (session.id = third_session and session.user_id = third_uid)) and amr.authentication_method = 'password'));
  insert into kaq_private.learning_accounts(id) values(first_uid), (second_uid);
  insert into kaq_private.learning_memberships(auth_user_id, account_id) values(first_uid, first_uid), (second_uid, second_uid);
  insert into kaq_private.learning_session_grants(session_id, auth_user_id, account_id, membership_epoch, reason)
    values(first_session, first_uid, first_uid, 0, 'legacy'), (second_session, second_uid, second_uid, 0, 'legacy');
  insert into public.learning_state(user_id) values(first_uid), (second_uid);
  for relation_record in select schemaname, tablename from pg_tables
    where schemaname in ('auth', 'kaq_private', 'public') order by schemaname, tablename loop
    execute format('insert into locking_scope_snapshot select %L, %L,
      coalesce(jsonb_agg(to_jsonb(row) order by to_jsonb(row)::text), ''[]''::jsonb) from %I.%I row',
      relation_record.schemaname, relation_record.tablename, relation_record.schemaname, relation_record.tablename);
  end loop;
  claims := jsonb_build_object('sub', first_uid, 'session_id', first_session, 'role', 'authenticated',
    'aud', 'authenticated', 'exp', floor(extract(epoch from clock_timestamp())) + 3600);
  headers := jsonb_build_object('x-kaq-account-id', first_uid::text, 'x-kaq-membership-epoch', '0');
  perform set_config('request.jwt.claims', claims::text, true);
  perform set_config('request.headers', headers::text, true);
  grant_update := format('update kaq_private.learning_session_grants set %%s where session_id = %L', first_session);
  account_update := format('update kaq_private.learning_accounts set %%s where id = %L', first_uid);
  member_update := format('update kaq_private.learning_memberships set %%s where auth_user_id = %L', first_uid);
  perform pg_temp.case_lock_scope('writer_success', 'select 1', accepted => true);
  perform pg_temp.case_lock_scope('reset_success', 'select 1', mode => 'reset', accepted => true);
  perform pg_temp.case_lock_scope('merge_success_internal_scope_only', 'select 1', mode => 'merge',
    targets => array[second_uid, first_uid], sessions => array[second_session], accepted => true);
  perform pg_temp.case_lock_scope('writer_to_reset_reentry_refused',
    'select kaq_private.lock_learning_scope(''writer'',0)', 'PT409', 'KAQ_SCOPE_REENTRY', mode => 'reset');
  perform pg_temp.case_lock_scope('writer_to_merge_reentry_refused',
    'select kaq_private.lock_learning_scope(''writer'',0)', 'PT409', 'KAQ_SCOPE_REENTRY',
    mode => 'merge', targets => array[first_uid, second_uid], sessions => array[second_session]);
  perform pg_temp.case_lock_scope('same_account_refused', 'select 1', 'PT409', 'KAQ_SAME_ACCOUNT',
    mode => 'merge', targets => array[first_uid, first_uid]);
  perform pg_temp.case_lock_scope('merge_without_actor_refused', 'select 1', mode => 'merge', targets => array[second_uid, third_uid]);
  perform pg_temp.case_lock_scope('unknown_related_uid_refused', 'select 1', mode => 'merge',
    targets => array[first_uid, second_uid], sessions => array[third_session]);
  perform pg_temp.case_lock_scope('expired_related_session_refused', format(
    'update auth.sessions set not_after = clock_timestamp() - interval ''1 second'' where id = %L', second_session),
    '28000', 'KAQ_SESSION_INVALID', mode => 'merge', targets => array[first_uid, second_uid], sessions => array[second_session]);
  perform pg_temp.case_lock_scope('missing_related_session_refused', 'select 1', '28000', 'KAQ_SESSION_INVALID',
    mode => 'merge', targets => array[first_uid, second_uid], sessions => array[gen_random_uuid()]);
  for case_record in select * from (values
    ('bad_mode', 'other', 0::bigint), ('negative_generation', 'writer', -1::bigint),
    ('null_generation', 'writer', null::bigint)
  ) cases(label, mode, generation) loop
    perform pg_temp.case_lock_scope(case_record.label, 'select 1', 'PT400', 'KAQ_SCOPE_ARGUMENT_INVALID',
      mode => case_record.mode, generation => case_record.generation);
  end loop;
  perform pg_temp.case_lock_scope('writer_cannot_add_target_accounts', 'select 1', 'PT400', 'KAQ_SCOPE_ARGUMENT_INVALID', targets => array[first_uid]);
  perform pg_temp.case_lock_scope('writer_cannot_add_related_sessions', 'select 1', 'PT400', 'KAQ_SCOPE_ARGUMENT_INVALID', sessions => array[second_session]);
  perform pg_temp.case_lock_scope('null_related_sessions_refused', 'select 1', 'PT400', 'KAQ_SCOPE_ARGUMENT_INVALID', sessions => null);
  perform pg_temp.case_lock_scope('null_session_item_refused', 'select 1', 'PT400', 'KAQ_SCOPE_ARGUMENT_INVALID', sessions => array[null::uuid]);
  perform pg_temp.case_lock_scope('old_epoch_grant_refused', format(member_update, 'epoch = 1'), 'PT401', 'KAQ_REAUTHENTICATION_REQUIRED');
  for case_record in select * from (values
    ('revoked_grant', 'revoked_at = clock_timestamp()'), ('wrong_grant_epoch', 'membership_epoch = 1')
  ) cases(label, patch) loop
    perform pg_temp.case_lock_scope(case_record.label, format(grant_update, case_record.patch), 'PT401', 'KAQ_REAUTHENTICATION_REQUIRED');
  end loop;
  if has_grant_member_account_fk then
    perform pg_temp.case_lock_scope('wrong_grant_user', format(grant_update, format('auth_user_id = %L', second_uid)),
      '23503', null, expected_constraint => 'learning_session_grants_member_account_fkey');
    perform pg_temp.case_lock_scope('wrong_grant_account', format(grant_update, format('account_id = %L', second_uid)),
      '23503', null, expected_constraint => 'learning_session_grants_member_account_fkey');
  else
    perform pg_temp.case_lock_scope('wrong_grant_user', format(grant_update, format('auth_user_id = %L', second_uid)),
      'PT401', 'KAQ_REAUTHENTICATION_REQUIRED');
    perform pg_temp.case_lock_scope('wrong_grant_account', format(grant_update, format('account_id = %L', second_uid)),
      'PT401', 'KAQ_REAUTHENTICATION_REQUIRED');
  end if;
  perform pg_temp.case_lock_scope('missing_grant', format('delete from kaq_private.learning_session_grants where session_id = %L', first_session),
    'PT401', 'KAQ_REAUTHENTICATION_REQUIRED');
  perform pg_temp.case_lock_scope('old_session_account_fence_refused', format(account_update,
    'session_fence_at = clock_timestamp() + interval ''1 hour'''), 'PT401', 'KAQ_REAUTHENTICATION_REQUIRED');
  perform pg_temp.case_lock_scope('old_session_member_fence_refused', format(member_update,
    'session_fence_at = clock_timestamp() + interval ''1 hour'''), 'PT401', 'KAQ_REAUTHENTICATION_REQUIRED');
  perform pg_temp.case_lock_scope('password_amr_not_fresh_oauth', format(account_update, format(
    'session_fence_at = (select created_at from auth.sessions where id = %L)', first_session)), 'PT401', 'KAQ_REAUTHENTICATION_REQUIRED');
  -- 実Auth行の時刻/AMRを管理接続で不正入力へ変える負例。OAuth成功を模倣・成立扱いにはしない。
  perform pg_temp.case_lock_scope('created_equal_fence_refused', format(account_update, format(
    'session_fence_at = (select created_at from auth.sessions where id = %L)', first_session)) || format(
    '; update auth.mfa_amr_claims set authentication_method=''oauth'', updated_at=
       (select created_at + interval ''1 microsecond'' from auth.sessions where id=%L)
       where session_id=%L and authentication_method=''password''', first_session, first_session), 'PT401', 'KAQ_REAUTHENTICATION_REQUIRED');
  perform pg_temp.case_lock_scope('oauth_equal_fence_refused', format(account_update, format(
    'session_fence_at = (select created_at from auth.sessions where id = %L)', first_session)) || format(
    '; update auth.mfa_amr_claims set authentication_method=''oauth'', updated_at=
       (select created_at from auth.sessions where id=%L) where session_id=%L and authentication_method=''password'';
       update auth.sessions set created_at=created_at+interval ''1 microsecond'' where id=%L',
    first_session, first_session, first_session), 'PT401', 'KAQ_REAUTHENTICATION_REQUIRED');
  if has_grant_member_account_fk then
    perform pg_temp.case_lock_scope('bare_proof_reason_rejected', format(grant_update, 'reason=''proof'''),
      '23514', null, expected_constraint => 'learning_session_grants_proof_shape_check');
  else
    perform pg_temp.case_lock_scope('bare_proof_reason_rejected',
      format(account_update, 'session_fence_at=clock_timestamp()+interval ''1 hour''') || ';' ||
      format(grant_update, 'reason=''proof'''), 'PT401', 'KAQ_REAUTHENTICATION_REQUIRED');
  end if;
  perform pg_temp.case_lock_scope('revoked_old_session_not_reenrolled', format(grant_update, 'revoked_at = clock_timestamp()') || ';' ||
    format('select set_config(''request.jwt.claims'', %L, true)', (claims || jsonb_build_object('iat', floor(extract(epoch from clock_timestamp()))))::text),
    'PT401', 'KAQ_REAUTHENTICATION_REQUIRED');
  perform pg_temp.case_lock_scope('missing_actor_session', format('delete from auth.sessions where id = %L', first_session), '28000', 'KAQ_SESSION_INVALID');
  perform pg_temp.case_lock_scope('expired_actor_session', format(
    'update auth.sessions set not_after = clock_timestamp() - interval ''1 second'' where id = %L', first_session), '28000', 'KAQ_SESSION_INVALID');
  perform pg_temp.case_lock_scope('banned_actor', format('update auth.users set banned_until = clock_timestamp() + interval ''1 hour'' where id = %L', first_uid),
    '28000', 'KAQ_SESSION_INVALID');
  perform pg_temp.case_lock_scope('deleted_actor', format('update auth.users set deleted_at = clock_timestamp() where id = %L', first_uid),
    '28000', 'KAQ_SESSION_INVALID');
  perform pg_temp.case_lock_scope('generation_stale', format('update public.learning_state set generation = 1 where user_id = %L', first_uid),
    'PT409', 'KAQ_GENERATION_STALE');
  perform pg_temp.case_lock_scope('state_missing', format('delete from public.learning_state where user_id = %L', first_uid), 'PT409', 'KAQ_STATE_UNAVAILABLE');
  perform pg_temp.case_lock_scope('disabled_member', format(member_update, 'status = ''disabled'''), 'PT403', 'KAQ_ACCOUNT_DISABLED');
  perform pg_temp.case_lock_scope('deleting_account', format(account_update, 'status = ''deleting'''), 'PT403', 'KAQ_ACCOUNT_DISABLED');
  perform pg_temp.case_lock_scope('onboarding_unassigned', format('delete from kaq_private.learning_memberships where auth_user_id = %L', first_uid),
    'PT409', 'KAQ_ONBOARDING_REQUIRED');
  perform pg_temp.case_lock_scope('forged_account_header', format('select set_config(''request.headers'', %L, true)',
    (headers || jsonb_build_object('x-kaq-account-id', second_uid::text))::text));
  perform pg_temp.case_lock_scope('stale_epoch_header', format('select set_config(''request.headers'', %L, true)',
    (headers || '{"x-kaq-membership-epoch":"1"}'::jsonb)::text));
  perform pg_temp.case_lock_scope('bad_epoch_header', format('select set_config(''request.headers'', %L, true)',
    (headers || '{"x-kaq-membership-epoch":"-1"}'::jsonb)::text));
  perform pg_temp.case_lock_scope('expired_claim', format('select set_config(''request.jwt.claims'', %L, true)',
    (claims || '{"exp":1}'::jsonb)::text), '28000', 'KAQ_AUTH_CONTEXT_INVALID');
  perform pg_temp.case_lock_scope('wrong_role_claim', format('select set_config(''request.jwt.claims'', %L, true)',
    (claims || '{"role":"service_role"}'::jsonb)::text), '28000', 'KAQ_AUTH_CONTEXT_INVALID');
  perform pg_temp.case_lock_scope('legacy_unbound_success', 'select set_config(''request.headers'', ''{}'', true)', accepted => true);
  perform pg_temp.case_lock_scope('unbound_nonlegacy_refused', format(grant_update, 'reason = ''reauthenticated''') ||
    '; select set_config(''request.headers'', ''{}'', true)');
  perform pg_temp.case_lock_scope('shared_account_all_members_locked', format(
    'insert into kaq_private.learning_memberships(auth_user_id, account_id) values(%L, %L)', third_uid, first_uid), accepted => true);
  for function_record in select oid, proname, prosecdef, provolatile, proconfig, proacl, proowner from pg_proc
    where oid in ('kaq_private.lock_request_context()'::regprocedure,
      'kaq_private.lock_learning_scope(text,bigint,uuid[],uuid[])'::regprocedure) loop
    perform pg_temp.check_lock_scope('volatile_fixed_path_' || function_record.proname, function_record.prosecdef
      and function_record.provolatile = 'v' and function_record.proconfig @> array['search_path=pg_catalog, auth, kaq_private']);
    perform pg_temp.check_lock_scope('owner_only_acl_' || function_record.proname, not exists(
      select 1 from aclexplode(coalesce(function_record.proacl, acldefault('f', function_record.proowner))) privilege
      where privilege.privilege_type = 'EXECUTE' and privilege.grantee <> function_record.proowner));
    foreach role_name in array array['anon', 'authenticated', 'service_role'] loop
      perform pg_temp.check_lock_scope('execute_denied_' || function_record.proname || '_' || role_name,
        not has_function_privilege(role_name, function_record.oid, 'EXECUTE'));
    end loop;
  end loop;
  for relation_record in select * from locking_scope_snapshot order by schema_name, relation loop
    execute format('select coalesce(jsonb_agg(to_jsonb(row) order by to_jsonb(row)::text), ''[]''::jsonb) from %I.%I row',
      relation_record.schema_name, relation_record.relation) into contents_after;
    perform pg_temp.check_lock_scope('unchanged_' || relation_record.schema_name || '_' || relation_record.relation,
      contents_after = relation_record.contents);
  end loop;
end $$;
select json_build_object('status', 'passed', 'checks', json_agg(name order by name), 'scope', 'private_locking_component') from locking_scope_checks;
rollback;
