-- 既存fixtureのGoTrue実OAuth loginが作った2 sessionを置換して実行する。Auth sessionの偽物は作らない。
-- foundation migrationとsupabase/account-merge/session-resolver.sql適用後、管理DB接続で実行する。
begin;
create temporary table session_resolver_checks (name text primary key) on commit drop;
create temporary table session_resolver_snapshot (relation text primary key, contents jsonb not null) on commit drop;
create function pg_temp.check_session(label text, passed boolean) returns void language plpgsql as $$
begin
  if passed is distinct from true then raise exception 'Session assertion failed: %', label; end if;
  insert into session_resolver_checks values (label);
end $$;
create function pg_temp.reject_session(
  label text, user_uuid uuid, session_uuid uuid, sensitive boolean default false,
  expected text default 'KAQ_SESSION_INVALID'
) returns void language plpgsql as $$
begin
  begin
    perform kaq_private.assert_live_session(user_uuid, session_uuid, sensitive);
  exception when sqlstate '28000' then
    if sqlerrm <> expected then raise exception 'Session % expected %, received %', label, expected, sqlerrm; end if;
    perform pg_temp.check_session(label, true);
    return;
  end;
  raise exception 'Session accepted invalid input: %', label;
end $$;
create function pg_temp.mutate_session(
  label text, statement text, user_uuid uuid, session_uuid uuid, sensitive boolean default false,
  expected text default 'KAQ_SESSION_INVALID', accepts boolean default false
) returns void language plpgsql as $$
begin
  -- 各caseで作るban/期限/factor/削除をsubtransactionで戻し、次のcaseへ汚染しない。
  begin
    execute statement;
    if accepts then
      perform kaq_private.assert_live_session(user_uuid, session_uuid, sensitive);
    else
      perform pg_temp.reject_session(label, user_uuid, session_uuid, sensitive, expected);
    end if;
    raise sqlstate 'ZX001';
  exception when sqlstate 'ZX001' then null;
  end;
  perform pg_temp.check_session(label, true);
end $$;
do $$
declare
  first_uid uuid := '__FIRST_USER__'; second_uid uuid := '__SECOND_USER__';
  first_session uuid := '__FIRST_SESSION__'; second_session uuid := '__SECOND_SESSION__';
  resolved auth.sessions%rowtype;
  role_name text;
  function_oid oid := 'kaq_private.assert_live_session(uuid,uuid,boolean)'::regprocedure;
  factor_id uuid := gen_random_uuid(); client_id uuid := gen_random_uuid();
  factor_statement text;
  relation_record record; current_contents jsonb;
begin
  for relation_record in select tablename from pg_tables where schemaname = 'auth' order by tablename loop
    execute format('insert into session_resolver_snapshot select %L,
      coalesce(jsonb_agg(to_jsonb(row) order by to_jsonb(row)::text), ''[]''::jsonb) from auth.%I row',
      relation_record.tablename, relation_record.tablename);
  end loop;
  perform pg_temp.check_session('different_real_users', first_uid <> second_uid);
  perform pg_temp.check_session('different_real_sessions', first_session <> second_session);
  perform pg_temp.check_session('real_gotrue_oauth_sessions', (
    select count(*) = 2 from auth.sessions session join auth.mfa_amr_claims amr on amr.session_id = session.id
    where ((session.id = first_session and session.user_id = first_uid)
      or (session.id = second_session and session.user_id = second_uid)) and amr.authentication_method = 'oauth'));
  select * into resolved from kaq_private.assert_live_session(first_uid, first_session);
  perform pg_temp.check_session('returns_real_session', resolved.id = first_session and resolved.user_id = first_uid);
  perform pg_temp.check_session('second_internal_proof_is_resolvable',
    (kaq_private.assert_live_session(second_uid, second_session)).id = second_session);
  perform pg_temp.check_session('no_factor_required_for_sensitive',
    not exists(select 1 from auth.mfa_factors where user_id = first_uid and status = 'verified')
    and (kaq_private.assert_live_session(first_uid, first_session, true)).id = first_session);

  perform pg_temp.reject_session('null_user', null, first_session);
  perform pg_temp.reject_session('null_session', first_uid, null);
  perform pg_temp.reject_session('null_sensitivity', first_uid, first_session, null);
  perform pg_temp.reject_session('zero_user', '00000000-0000-0000-0000-000000000000', first_session);
  perform pg_temp.reject_session('zero_session', first_uid, '00000000-0000-0000-0000-000000000000');
  perform pg_temp.reject_session('missing_user', gen_random_uuid(), first_session);
  perform pg_temp.reject_session('missing_session', first_uid, gen_random_uuid());
  perform pg_temp.reject_session('other_user_session', first_uid, second_session);
  perform pg_temp.reject_session('other_session_user', second_uid, first_session);

  perform pg_temp.mutate_session('expired_not_after', format(
    'update auth.sessions set not_after = clock_timestamp() - interval ''1 second'' where id = %L', first_session), first_uid, first_session);
  perform pg_temp.mutate_session('null_not_after_allows_live_session', format(
    'update auth.sessions set not_after = null where id = %L', first_session), first_uid, first_session, accepts => true);
  perform pg_temp.mutate_session('future_not_after_allows_live_session', format(
    'update auth.sessions set not_after = clock_timestamp() + interval ''1 hour'' where id = %L', first_session), first_uid, first_session, accepts => true);
  perform pg_temp.mutate_session('invalid_not_after', format(
    'update auth.sessions set not_after = ''infinity'' where id = %L', first_session), first_uid, first_session);
  perform pg_temp.mutate_session('missing_created_at', format(
    'update auth.sessions set created_at = null where id = %L', first_session), first_uid, first_session);
  perform pg_temp.mutate_session('invalid_created_at', format(
    'update auth.sessions set created_at = ''infinity'' where id = %L', first_session), first_uid, first_session);
  perform pg_temp.mutate_session('zero_created_at', format(
    'update auth.sessions set created_at = ''epoch'' where id = %L', first_session), first_uid, first_session);
  perform pg_temp.mutate_session('future_created_at', format(
    'update auth.sessions set created_at = clock_timestamp() + interval ''1 hour'' where id = %L', first_session), first_uid, first_session);
  perform pg_temp.mutate_session('banned_user', format(
    'update auth.users set banned_until = clock_timestamp() + interval ''1 hour'' where id = %L', first_uid), first_uid, first_session);
  perform pg_temp.mutate_session('past_ban_allows_live_session', format(
    'update auth.users set banned_until = clock_timestamp() - interval ''1 second'' where id = %L', first_uid), first_uid, first_session, accepts => true);
  perform pg_temp.mutate_session('soft_deleted_user', format(
    'update auth.users set deleted_at = clock_timestamp() where id = %L', first_uid), first_uid, first_session);
  perform pg_temp.mutate_session('logged_out_session', format(
    'delete from auth.sessions where id = %L', first_session), first_uid, first_session);
  perform pg_temp.mutate_session('hard_deleted_user', format(
    'delete from auth.users where id = %L', first_uid), first_uid, first_session);
  perform pg_temp.mutate_session('third_party_oauth_session', format(
    'insert into auth.oauth_clients(id, registration_type, client_type, redirect_uris, grant_types, token_endpoint_auth_method)
      values(%L, ''manual'', ''public'', ''https://fixture.invalid/callback'', ''authorization_code'', ''none'');
     update auth.sessions set oauth_client_id = %L where id = %L', client_id, client_id, first_session), first_uid, first_session);

  factor_statement := format(
    'insert into auth.mfa_factors(id, user_id, factor_type, status, created_at, updated_at)
      values(%L, %L, ''totp'', ''verified'', clock_timestamp(), clock_timestamp());
     update auth.sessions set aal = ''aal1'' where id = %L', factor_id, first_uid, first_session);
  perform pg_temp.mutate_session('verified_factor_requires_step_up', factor_statement,
    first_uid, first_session, true, 'KAQ_STEP_UP_REQUIRED');
  perform pg_temp.mutate_session('null_aal_requires_step_up', factor_statement || format(
    '; update auth.sessions set aal = null where id = %L', first_session), first_uid, first_session, true, 'KAQ_STEP_UP_REQUIRED');
  perform pg_temp.mutate_session('verified_factor_does_not_block_normal_access', factor_statement,
    first_uid, first_session, accepts => true);
  perform pg_temp.mutate_session('unverified_factor_does_not_require_mfa', factor_statement || format(
    '; update auth.mfa_factors set status = ''unverified'' where id = %L', factor_id), first_uid, first_session, true, accepts => true);
  perform pg_temp.mutate_session('aal2_allows_sensitive_access', factor_statement || format(
    '; update auth.sessions set aal = ''aal2'' where id = %L', first_session), first_uid, first_session, true, accepts => true);
  perform pg_temp.mutate_session('aal3_is_not_below_aal2', factor_statement || format(
    '; update auth.sessions set aal = ''aal3'' where id = %L', first_session), first_uid, first_session, true, accepts => true);

  perform pg_temp.check_session('security_definer_fixed_search_path', exists(
    select 1 from pg_proc where oid = function_oid and prosecdef
      and proconfig @> array['search_path=pg_catalog, auth, kaq_private']));
  perform pg_temp.check_session('only_owner_has_execute_acl', not exists(
    select 1 from pg_proc function_record,
      lateral aclexplode(coalesce(function_record.proacl, acldefault('f', function_record.proowner))) privilege
    where function_record.oid = function_oid and privilege.privilege_type = 'EXECUTE'
      and privilege.grantee <> function_record.proowner));
  foreach role_name in array array['anon', 'authenticated', 'service_role'] loop
    perform pg_temp.check_session('execute_denied_' || role_name,
      not has_function_privilege(role_name, function_oid, 'EXECUTE'));
    begin
      execute format('set local role %I', role_name);
      perform kaq_private.assert_live_session(first_uid, first_session);
      raise exception 'Private session helper accepted role: %', role_name;
    exception when insufficient_privilege then null;
    end;
    perform pg_temp.check_session('actual_execute_denied_' || role_name, true);
  end loop;
  perform pg_temp.check_session('all_auth_mutations_restored',
    (kaq_private.assert_live_session(first_uid, first_session)).id = first_session
    and (kaq_private.assert_live_session(second_uid, second_session)).id = second_session
    and not exists(select 1 from auth.mfa_factors where id = factor_id)
    and not exists(select 1 from auth.oauth_clients where id = client_id));
  for relation_record in select relation, contents from session_resolver_snapshot order by relation loop
    execute format('select coalesce(jsonb_agg(to_jsonb(row) order by to_jsonb(row)::text), ''[]''::jsonb)
      from auth.%I row', relation_record.relation) into current_contents;
    perform pg_temp.check_session('restored_auth_' || relation_record.relation, current_contents = relation_record.contents);
  end loop;
end $$;
select json_build_object('status', 'passed', 'checks', json_agg(name order by name)) from session_resolver_checks;
rollback;
