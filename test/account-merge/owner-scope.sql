-- 実2OIDC/GoTrue sessionの4 placeholderを親runnerが置換する。署名検証そのものはこのSQLの対象外。
-- claims/header GUCは検証済みREST contextを表す試験入力であり、生JWTをSQLで認証する実装ではない。
-- foundation/session-resolver/owner-scope適用後、管理接続で実行。製品RLSは変更せずtemp tableだけでpolicy経由を検査する。
begin;
create temporary table owner_scope_checks (name text primary key) on commit drop;
create temporary table owner_scope_snapshot (schema_name text, relation text, contents jsonb) on commit drop;
create function pg_temp.check_scope(label text, passed boolean) returns void language plpgsql as $$
begin
  if passed is distinct from true then raise exception 'Owner scope assertion failed: %', label; end if;
  insert into owner_scope_checks values (label);
end $$;
create function pg_temp.reject_scope(label text, expected_state text, expected_message text, actor_only boolean)
returns void language plpgsql as $$
declare actual_state text; actual_message text;
begin
  begin
    if actor_only then perform kaq_private.read_actor_session();
    else perform kaq_private.read_learning_account(); end if;
  exception when others then
    get stacked diagnostics actual_state = returned_sqlstate, actual_message = message_text;
    if actual_state <> expected_state or actual_message <> expected_message then
      raise exception 'Owner scope % expected %/%, received %/%', label,
        expected_state, expected_message, actual_state, actual_message;
    end if;
    return;
  end;
  raise exception 'Owner scope accepted invalid input: %', label;
end $$;
create function pg_temp.mutate_scope(
  label text, statement text, expected_state text default 'PT403', expected_message text default 'KAQ_SCOPE_INVALID',
  accepted_uuid uuid default null, actor_only boolean default false, expected_constraint text default null
) returns void language plpgsql as $$
declare resolved uuid; actual_state text; actual_constraint text; constraint_rejected boolean := false;
begin
  -- 各caseのAuth/private表/GUC変更をrollbackし、読み取りresolverがgrantを更新しないことも最後に照合する。
  begin
    begin
      execute statement;
    exception when foreign_key_violation then
      get stacked diagnostics actual_state = returned_sqlstate, actual_constraint = constraint_name;
      if expected_constraint is null or actual_state <> expected_state or actual_constraint <> expected_constraint then
        raise exception 'Owner scope % expected %/constraint %, received %/%', label,
          expected_state, expected_constraint, actual_state, actual_constraint;
      end if;
      constraint_rejected := true;
    end;
    if not constraint_rejected then
      if expected_constraint is not null then raise exception 'Owner scope mutation accepted invalid input: %', label; end if;
      if expected_state = '00000' then
        if actor_only then resolved := (kaq_private.read_actor_session()).id;
        else resolved := kaq_private.read_learning_account(); end if;
        if resolved is distinct from accepted_uuid then raise exception 'Owner scope % returned %', label, resolved; end if;
      else
        perform pg_temp.reject_scope(label, expected_state, expected_message, actor_only);
      end if;
    end if;
    raise sqlstate 'ZX001';
  exception when sqlstate 'ZX001' then null;
  end;
  perform pg_temp.check_scope(label, true);
end $$;
do $$
declare
  first_uid uuid := '__FIRST_USER__'; second_uid uuid := '__SECOND_USER__';
  first_session uuid := '__FIRST_SESSION__'; second_session uuid := '__SECOND_SESSION__';
  third_account uuid := gen_random_uuid(); client_id uuid := gen_random_uuid(); factor_id uuid := gen_random_uuid();
  claims jsonb; headers jsonb; case_record record; relation_record record; contents_after jsonb;
  session_update text; user_update text; grant_update text; account_update text; membership_update text;
  first_created timestamptz; fence_statement text; has_grant_member_account_fk boolean;
begin
  select exists(select 1 from pg_constraint
    where conrelid = 'kaq_private.learning_session_grants'::regclass
      and conname = 'learning_session_grants_member_account_fkey' and contype = 'f') into has_grant_member_account_fk;
  perform pg_temp.check_scope('real_distinct_oauth_sessions', first_uid <> second_uid and first_session <> second_session and (
    select count(*) = 2 from auth.sessions session join auth.mfa_amr_claims amr on amr.session_id = session.id
    where ((session.id = first_session and session.user_id = first_uid)
      or (session.id = second_session and session.user_id = second_uid)) and amr.authentication_method = 'oauth'));
  select created_at into strict first_created from auth.sessions where id = first_session;
  insert into kaq_private.learning_accounts(id) values(first_uid), (second_uid);
  insert into kaq_private.learning_memberships(auth_user_id, account_id) values(first_uid, first_uid), (second_uid, second_uid);
  insert into kaq_private.learning_session_grants(session_id, auth_user_id, account_id, membership_epoch, reason)
    values(first_session, first_uid, first_uid, 0, 'legacy'), (second_session, second_uid, second_uid, 0, 'legacy');
  for relation_record in select schemaname, tablename from pg_tables
    where schemaname in ('auth', 'kaq_private') order by schemaname, tablename loop
    execute format('insert into owner_scope_snapshot select %L, %L,
      coalesce(jsonb_agg(to_jsonb(row) order by to_jsonb(row)::text), ''[]''::jsonb) from %I.%I row',
      relation_record.schemaname, relation_record.tablename, relation_record.schemaname, relation_record.tablename);
  end loop;
  claims := jsonb_build_object('sub', first_uid, 'session_id', first_session, 'role', 'authenticated',
    'aud', 'authenticated', 'exp', floor(extract(epoch from statement_timestamp())) + 3600);
  headers := jsonb_build_object('x-kaq-account-id', first_uid::text, 'x-kaq-membership-epoch', '0');
  perform set_config('request.jwt.claims', claims::text, true);
  perform set_config('request.headers', headers::text, true);
  perform pg_temp.check_scope('bound_owner_resolved', kaq_private.read_learning_account() = first_uid);
  perform pg_temp.check_scope('actor_returns_real_session', (kaq_private.read_actor_session()).id = first_session);
  perform pg_temp.mutate_scope('unbound_legacy_allowed', 'select set_config(''request.headers'', ''{}'', true)',
    '00000', null, first_uid);
  perform pg_temp.mutate_scope('second_real_owner_resolved', format(
    'select set_config(''request.jwt.claims'', %L, true); select set_config(''request.headers'', %L, true)',
    (claims || jsonb_build_object('sub', second_uid, 'session_id', second_session))::text,
    jsonb_build_object('x-kaq-account-id', second_uid::text, 'x-kaq-membership-epoch', '0')::text), '00000', null, second_uid);

  for case_record in select * from (values
    ('partial_account_header', jsonb_build_object('x-kaq-account-id', first_uid::text)),
    ('partial_epoch_header', jsonb_build_object('x-kaq-membership-epoch', '0')),
    ('forged_other_account', headers || jsonb_build_object('x-kaq-account-id', second_uid::text)),
    ('zero_account_header', headers || '{"x-kaq-account-id":"00000000-0000-0000-0000-000000000000"}'::jsonb),
    ('bad_account_uuid', headers || '{"x-kaq-account-id":"not-a-uuid"}'::jsonb),
    ('empty_account_header', headers || '{"x-kaq-account-id":""}'::jsonb),
    ('null_account_header', headers || '{"x-kaq-account-id":null}'::jsonb),
    ('numeric_epoch_header', headers || '{"x-kaq-membership-epoch":0}'::jsonb),
    ('negative_epoch', headers || '{"x-kaq-membership-epoch":"-1"}'::jsonb),
    ('overflow_epoch', headers || '{"x-kaq-membership-epoch":"9223372036854775808"}'::jsonb),
    ('leading_zero_epoch', headers || '{"x-kaq-membership-epoch":"00"}'::jsonb),
    ('plus_epoch', headers || '{"x-kaq-membership-epoch":"+0"}'::jsonb),
    ('fraction_epoch', headers || '{"x-kaq-membership-epoch":"0.5"}'::jsonb),
    ('empty_epoch', headers || '{"x-kaq-membership-epoch":""}'::jsonb),
    ('wrong_epoch_header', headers || '{"x-kaq-membership-epoch":"1"}'::jsonb),
    ('array_headers', '[]'::jsonb)
  ) cases(label, value) loop
    perform pg_temp.mutate_scope(case_record.label, format('select set_config(''request.headers'', %L, true)', case_record.value::text));
  end loop;
  perform pg_temp.mutate_scope('malformed_headers', 'select set_config(''request.headers'', ''{broken'', true)');

  for case_record in select * from (values
    ('missing_sub', claims - 'sub'), ('null_sub', claims || '{"sub":null}'::jsonb),
    ('invalid_sub', claims || '{"sub":"invalid"}'::jsonb),
    ('zero_sub', claims || '{"sub":"00000000-0000-0000-0000-000000000000"}'::jsonb),
    ('missing_session_claim', claims - 'session_id'), ('null_session_claim', claims || '{"session_id":null}'::jsonb),
    ('invalid_session_claim', claims || '{"session_id":"invalid"}'::jsonb),
    ('zero_session_claim', claims || '{"session_id":"00000000-0000-0000-0000-000000000000"}'::jsonb),
    ('missing_role', claims - 'role'), ('anon_role', claims || '{"role":"anon"}'::jsonb),
    ('service_role_claim', claims || '{"role":"service_role"}'::jsonb),
    ('missing_audience', claims - 'aud'), ('wrong_audience', claims || '{"aud":"other-project-audience"}'::jsonb),
    ('empty_audience_array', claims || '{"aud":[]}'::jsonb),
    ('mixed_type_audience', claims || '{"aud":["authenticated",1]}'::jsonb),
    ('missing_exp', claims - 'exp'), ('null_exp', claims || '{"exp":null}'::jsonb),
    ('string_exp', claims || jsonb_build_object('exp', (claims ->> 'exp'))),
    ('fraction_exp', claims || '{"exp":1.5}'::jsonb),
    ('overflow_exp', claims || '{"exp":9223372036854775808}'::jsonb),
    ('expired_jwt', claims || jsonb_build_object('exp', floor(extract(epoch from statement_timestamp())) - 1)),
    ('array_claims', '[]'::jsonb)
  ) cases(label, value) loop
    perform pg_temp.mutate_scope(case_record.label,
      format('select set_config(''request.jwt.claims'', %L, true)', case_record.value::text),
      '28000', 'KAQ_AUTH_CONTEXT_INVALID');
  end loop;
  perform pg_temp.mutate_scope('empty_claims', 'select set_config(''request.jwt.claims'', '''', true)', '28000', 'KAQ_AUTH_CONTEXT_INVALID');
  perform pg_temp.mutate_scope('raw_jwt_is_not_claims_json',
    'select set_config(''request.jwt.claims'', ''eyJhbGciOiJSUzI1NiJ9.e30.invalid'', true)', '28000', 'KAQ_AUTH_CONTEXT_INVALID');
  perform pg_temp.mutate_scope('audience_array_accepted', format('select set_config(''request.jwt.claims'', %L, true)',
    (claims || '{"aud":["authenticated"]}'::jsonb)::text), '00000', null, first_uid);
  perform pg_temp.mutate_scope('session_user_mismatch', format('select set_config(''request.jwt.claims'', %L, true)',
    (claims || jsonb_build_object('session_id', second_session))::text), '28000', 'KAQ_SESSION_INVALID');

  session_update := format('update auth.sessions set %%s where id = %L', first_session);
  user_update := format('update auth.users set %%s where id = %L', first_uid);
  grant_update := format('update kaq_private.learning_session_grants set %%s where session_id = %L', first_session);
  account_update := format('update kaq_private.learning_accounts set %%s where id = %L', first_uid);
  membership_update := format('update kaq_private.learning_memberships set %%s where auth_user_id = %L', first_uid);
  for case_record in select * from (values
    ('expired_not_after', 'not_after = statement_timestamp() - interval ''1 second'''),
    ('invalid_not_after', 'not_after = ''infinity'''),
    ('missing_created_at', 'created_at = null'), ('invalid_created_at', 'created_at = ''infinity'''),
    ('zero_created_at', 'created_at = ''epoch'''), ('future_created_at', 'created_at = statement_timestamp() + interval ''1 hour''')
  ) cases(label, patch) loop
    perform pg_temp.mutate_scope(case_record.label, format(session_update, case_record.patch), '28000', 'KAQ_SESSION_INVALID', actor_only => true);
  end loop;
  perform pg_temp.mutate_scope('banned_user', format(user_update, 'banned_until = statement_timestamp() + interval ''1 hour'''),
    '28000', 'KAQ_SESSION_INVALID', actor_only => true);
  perform pg_temp.mutate_scope('soft_deleted_user', format(user_update, 'deleted_at = statement_timestamp()'),
    '28000', 'KAQ_SESSION_INVALID', actor_only => true);
  perform pg_temp.mutate_scope('missing_auth_user', format('delete from auth.users where id = %L', first_uid),
    '28000', 'KAQ_SESSION_INVALID', actor_only => true);
  perform pg_temp.mutate_scope('missing_auth_session', format('delete from auth.sessions where id = %L', first_session),
    '28000', 'KAQ_SESSION_INVALID', actor_only => true);
  perform pg_temp.mutate_scope('past_ban_allows_session', format(user_update, 'banned_until = statement_timestamp() - interval ''1 second'''),
    '00000', null, first_session, true);
  perform pg_temp.mutate_scope('null_not_after_allows_session', format(session_update, 'not_after = null'),
    '00000', null, first_session, true);
  perform pg_temp.mutate_scope('future_not_after_allows_session', format(session_update, 'not_after = statement_timestamp() + interval ''1 hour'''),
    '00000', null, first_session, true);
  perform pg_temp.mutate_scope('third_party_oauth_session', format(
    'insert into auth.oauth_clients(id, registration_type, client_type, redirect_uris, grant_types, token_endpoint_auth_method)
      values(%L, ''manual'', ''public'', ''https://fixture.invalid/callback'', ''authorization_code'', ''none'');
     update auth.sessions set oauth_client_id = %L where id = %L', client_id, client_id, first_session),
    '28000', 'KAQ_SESSION_INVALID', actor_only => true);
  perform pg_temp.mutate_scope('read_does_not_add_sensitive_mfa_requirement', format(
    'insert into auth.mfa_factors(id, user_id, factor_type, status, created_at, updated_at)
      values(%L, %L, ''totp'', ''verified'', statement_timestamp(), statement_timestamp());
     update auth.sessions set aal = ''aal1'' where id = %L', factor_id, first_uid, first_session), '00000', null, first_uid);

  for case_record in select * from (values
    ('wrong_grant_epoch', 'membership_epoch = 1'), ('revoked_grant', 'revoked_at = statement_timestamp()')
  ) cases(label, patch) loop
    perform pg_temp.mutate_scope(case_record.label, format(grant_update, case_record.patch), 'PT401', 'KAQ_REAUTHENTICATION_REQUIRED');
  end loop;
  if has_grant_member_account_fk then
    perform pg_temp.mutate_scope('wrong_grant_user', format(grant_update, format('auth_user_id = %L', second_uid)),
      '23503', null, expected_constraint => 'learning_session_grants_member_account_fkey');
    perform pg_temp.mutate_scope('wrong_grant_account', format(grant_update, format('account_id = %L', second_uid)),
      '23503', null, expected_constraint => 'learning_session_grants_member_account_fkey');
  else
    perform pg_temp.mutate_scope('wrong_grant_user', format(grant_update, format('auth_user_id = %L', second_uid)),
      'PT401', 'KAQ_REAUTHENTICATION_REQUIRED');
    perform pg_temp.mutate_scope('wrong_grant_account', format(grant_update, format('account_id = %L', second_uid)),
      'PT401', 'KAQ_REAUTHENTICATION_REQUIRED');
  end if;
  perform pg_temp.mutate_scope('missing_grant', format('delete from kaq_private.learning_session_grants where session_id = %L', first_session),
    'PT401', 'KAQ_REAUTHENTICATION_REQUIRED');
  perform pg_temp.mutate_scope('unassigned_onboarding', format('delete from kaq_private.learning_memberships where auth_user_id = %L', first_uid),
    'PT409', 'KAQ_ONBOARDING_REQUIRED');
  perform pg_temp.mutate_scope('disabled_membership', format(membership_update, 'status = ''disabled'''), 'PT403', 'KAQ_ACCOUNT_DISABLED');
  perform pg_temp.mutate_scope('detached_membership', format(membership_update, 'status = ''detached'''), 'PT403', 'KAQ_ACCOUNT_DISABLED');
  perform pg_temp.mutate_scope('deleting_account', format(account_update, 'status = ''deleting'''), 'PT403', 'KAQ_ACCOUNT_DISABLED');
  perform pg_temp.mutate_scope('retired_account', format(account_update, 'status = ''retired'', retired_at = statement_timestamp()'),
    'PT403', 'KAQ_ACCOUNT_DISABLED');
  perform pg_temp.mutate_scope('stale_header_after_epoch_change', format(membership_update, 'epoch = 1') || ';' ||
    format(grant_update, 'membership_epoch = 1'));
  perform pg_temp.mutate_scope('unbound_nonlegacy_grant', format(grant_update, 'reason = ''reauthenticated''') ||
    '; select set_config(''request.headers'', ''{}'', true)');
  perform pg_temp.mutate_scope('unbound_changed_account', format(account_update, 'membership_revision = 1') ||
    '; select set_config(''request.headers'', ''{}'', true)');
  perform pg_temp.mutate_scope('unbound_shared_account', format(
    'delete from kaq_private.learning_session_grants where session_id = %L;
     update kaq_private.learning_memberships set account_id = %L where auth_user_id = %L;
     select set_config(''request.headers'', ''{}'', true)', second_session, first_uid, second_uid));
  perform pg_temp.mutate_scope('explicit_new_owner_scope', format(
    'insert into kaq_private.learning_accounts(id, membership_revision) values(%L, 1);
     delete from kaq_private.learning_session_grants where session_id = %L;
     update kaq_private.learning_memberships set account_id = %L where auth_user_id = %L;
     insert into kaq_private.learning_session_grants(session_id, auth_user_id, account_id, membership_epoch, reason)
       values(%L, %L, %L, 0, ''reauthenticated'');
     select set_config(''request.headers'', %L, true)', third_account, first_session, third_account, first_uid,
    first_session, first_uid, third_account,
    jsonb_build_object('x-kaq-account-id', third_account::text, 'x-kaq-membership-epoch', '0')::text), '00000', null, third_account);

  fence_statement := format(account_update, format('session_fence_at = %L', first_created - interval '1 second'));
  perform pg_temp.mutate_scope('old_session_new_epoch_grant_still_rejected',
    format(account_update, 'session_fence_at = statement_timestamp() + interval ''1 hour'', membership_revision = 1') || ';' ||
    format(membership_update, 'epoch = 1') || ';' || format(grant_update, 'membership_epoch = 1') || ';' || format(
    'select set_config(''request.headers'', %L, true); select set_config(''request.jwt.claims'', %L, true)',
    (headers || '{"x-kaq-membership-epoch":"1"}'::jsonb)::text,
    (claims || jsonb_build_object('iat', floor(extract(epoch from statement_timestamp()))))::text), 'PT401', 'KAQ_REAUTHENTICATION_REQUIRED');
  perform pg_temp.mutate_scope('membership_fence_blocks_old_session',
    format(membership_update, 'session_fence_at = statement_timestamp() + interval ''1 hour'''), 'PT401', 'KAQ_REAUTHENTICATION_REQUIRED');
  perform pg_temp.mutate_scope('invalid_account_fence', format(account_update, 'session_fence_at = ''infinity'''),
    'PT401', 'KAQ_REAUTHENTICATION_REQUIRED');
  perform pg_temp.mutate_scope('old_session_fresh_oauth_still_rejected', format(account_update,
    format('session_fence_at = %L::timestamptz + interval ''1 second''', first_created)) || format(
    '; update auth.mfa_amr_claims set updated_at = %L::timestamptz + interval ''1 second''
       where session_id = %L and authentication_method = ''oauth''', first_created, first_session),
    'PT401', 'KAQ_REAUTHENTICATION_REQUIRED');
  perform pg_temp.mutate_scope('missing_oauth_amr_after_fence', fence_statement || format(
    '; delete from auth.mfa_amr_claims where session_id = %L and authentication_method = ''oauth''', first_session),
    'PT401', 'KAQ_REAUTHENTICATION_REQUIRED');
  perform pg_temp.mutate_scope('old_oauth_amr_after_fence', fence_statement || format(
    '; update auth.mfa_amr_claims set updated_at = %L::timestamptz - interval ''1 second''
       where session_id = %L and authentication_method = ''oauth''', first_created - interval '1 second', first_session), 'PT401', 'KAQ_REAUTHENTICATION_REQUIRED');
  perform pg_temp.mutate_scope('invalid_oauth_amr_after_fence', fence_statement || format(
    '; update auth.mfa_amr_claims set updated_at = ''infinity'' where session_id = %L and authentication_method = ''oauth''', first_session),
    'PT401', 'KAQ_REAUTHENTICATION_REQUIRED');
  perform pg_temp.mutate_scope('fresh_session_oauth_after_fence', fence_statement, '00000', null, first_uid);
  for case_record in select * from (values
    ('account_session_equal', account_update, first_created, first_created + interval '1 second'),
    ('account_oauth_equal', account_update, first_created - interval '1 second', first_created - interval '1 second'),
    ('account_both_equal', account_update, first_created, first_created),
    ('membership_session_equal', membership_update, first_created, first_created + interval '1 second'),
    ('membership_oauth_equal', membership_update, first_created - interval '1 second', first_created - interval '1 second'),
    ('membership_both_equal', membership_update, first_created, first_created)
  ) boundaries(label, statement, fence, oauth) loop
    perform pg_temp.mutate_scope(case_record.label, format(case_record.statement, format('session_fence_at = %L', case_record.fence))
      || format('; update auth.mfa_amr_claims set updated_at = %L where session_id = %L and authentication_method = ''oauth''',
        case_record.oauth, first_session), 'PT401', 'KAQ_REAUTHENTICATION_REQUIRED');
  end loop;
  perform pg_temp.mutate_scope('greater_membership_fence_used', fence_statement || ';' ||
    format(membership_update, format('session_fence_at = %L::timestamptz + interval ''1 second''', first_created)),
    'PT401', 'KAQ_REAUTHENTICATION_REQUIRED');
  perform pg_temp.mutate_scope('greater_account_fence_used', format(account_update,
    format('session_fence_at = %L::timestamptz + interval ''1 second''', first_created)) || ';' ||
    format(membership_update, format('session_fence_at = %L', first_created)), 'PT401', 'KAQ_REAUTHENTICATION_REQUIRED');
  perform pg_temp.mutate_scope('unbound_account_fence_forbidden', fence_statement || format(
    '; update auth.mfa_amr_claims set updated_at = %L where session_id = %L and authentication_method = ''oauth'';
     select set_config(''request.headers'', ''{}'', true)', first_created, first_session));
  perform pg_temp.mutate_scope('unbound_membership_fence_forbidden',
    format(membership_update, format('session_fence_at = %L', first_created - interval '1 second')) || format(
    '; update auth.mfa_amr_claims set updated_at = %L where session_id = %L and authentication_method = ''oauth'';
     select set_config(''request.headers'', ''{}'', true)', first_created, first_session));
  for relation_record in select * from owner_scope_snapshot order by schema_name, relation loop
    execute format('select coalesce(jsonb_agg(to_jsonb(row) order by to_jsonb(row)::text), ''[]''::jsonb) from %I.%I row',
      relation_record.schema_name, relation_record.relation) into contents_after;
    perform pg_temp.check_scope('unchanged_' || relation_record.schema_name || '_' || relation_record.relation,
      contents_after = relation_record.contents);
  end loop;
end $$;

create temporary table owner_scope_visible(account_id uuid) on commit drop;
insert into owner_scope_visible values('__FIRST_USER__'), ('__SECOND_USER__');
grant select on owner_scope_visible to authenticated;
alter table owner_scope_visible enable row level security;
create policy current_scope_only on owner_scope_visible to authenticated
  using(account_id = kaq_private.read_learning_account());
do $$
declare role_name text; function_record record; visible jsonb; first_uid uuid := '__FIRST_USER__';
begin
  for function_record in select oid, proname, prosecdef, provolatile, proconfig from pg_proc
    where oid in ('kaq_private.read_actor_session()'::regprocedure, 'kaq_private.read_learning_account()'::regprocedure) loop
    perform pg_temp.check_scope('stable_definer_fixed_path_' || function_record.proname,
      function_record.prosecdef and function_record.provolatile = 's'
      and function_record.proconfig @> array['search_path=pg_catalog, auth, kaq_private']);
  end loop;
  foreach role_name in array array['anon', 'authenticated', 'service_role'] loop
    perform pg_temp.check_scope('actor_execute_denied_' || role_name,
      not has_function_privilege(role_name, 'kaq_private.read_actor_session()', 'EXECUTE'));
    perform pg_temp.check_scope('scope_execute_minimal_' || role_name,
      has_function_privilege(role_name, 'kaq_private.read_learning_account()', 'EXECUTE') = (role_name = 'authenticated'));
    perform pg_temp.check_scope('no_private_usage_' || role_name, not has_schema_privilege(role_name, 'kaq_private', 'USAGE'));
    begin
      execute format('set local role %I', role_name);
      perform kaq_private.read_learning_account();
      raise exception 'Owner scope direct name resolution allowed: %', role_name;
    exception when insufficient_privilege then null;
    end;
    perform pg_temp.check_scope('direct_resolution_denied_' || role_name, true);
  end loop;
  execute format('grant usage on schema %I to authenticated', (select nspname from pg_namespace where oid = pg_my_temp_schema()));
  begin
    execute 'set local role authenticated';
    select jsonb_agg(account_id order by account_id) into visible from owner_scope_visible;
    execute 'reset role';
  end;
  perform pg_temp.check_scope('saved_rls_returns_only_verified_scope', visible = jsonb_build_array(first_uid));
end $$;
select json_build_object('status', 'passed', 'checks', json_agg(name order by name),
  'scope', 'read_snapshot_only', 'writerLockingResolverImplemented', false) from owner_scope_checks;
rollback;
