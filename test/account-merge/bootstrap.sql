-- 実2OIDC fixtureのAuth ID/sessionをrunnerが束縛する。全変更はrollbackする。
begin;
create temporary table bootstrap_checks (name text primary key) on commit drop;
create function pg_temp.check_bootstrap(label text, expected jsonb) returns void language plpgsql as $$
begin
  if kaq_private.read_account_bootstrap() is distinct from expected then
    raise exception 'Bootstrap mismatch: %, received %', label, kaq_private.read_account_bootstrap();
  end if;
  insert into bootstrap_checks values(label);
end $$;
create function pg_temp.mutate_bootstrap(label text, statement text, expected jsonb, expected_constraint text default null)
returns void language plpgsql as $$
declare actual_state text; actual_constraint text; constraint_rejected boolean := false;
begin
  begin
    begin
      execute statement;
    exception when foreign_key_violation then
      get stacked diagnostics actual_state = returned_sqlstate, actual_constraint = constraint_name;
      if expected_constraint is null or actual_state <> '23503' or actual_constraint <> expected_constraint then
        raise exception 'Bootstrap % expected 23503/constraint %, received %/%', label,
          expected_constraint, actual_state, actual_constraint;
      end if;
      constraint_rejected := true;
    end;
    if not constraint_rejected then
      if expected_constraint is not null then raise exception 'Bootstrap mutation accepted invalid input: %', label; end if;
      perform pg_temp.check_bootstrap(label, expected);
    end if;
    raise sqlstate 'ZX001';
  exception when sqlstate 'ZX001' then null;
  end;
  insert into bootstrap_checks values(label);
end $$;
do $$
declare
  first_uid uuid := '__FIRST_USER__'; second_uid uuid := '__SECOND_USER__';
  first_session uuid := '__FIRST_SESSION__'; second_session uuid := '__SECOND_SESSION__';
  ready jsonb; first_created timestamptz; case_row record;
  before_snapshot jsonb; after_snapshot jsonb; has_grant_member_account_fk boolean;
begin
  select exists(select 1 from pg_constraint
    where conrelid = 'kaq_private.learning_session_grants'::regclass
      and conname = 'learning_session_grants_member_account_fkey' and contype = 'f') into has_grant_member_account_fk;
  if not exists(select 1 from auth.mfa_amr_claims where session_id = first_session and authentication_method = 'oauth')
    or not exists(select 1 from auth.mfa_amr_claims where session_id = second_session and authentication_method = 'oauth') then
    raise exception 'Actual OAuth sessions required';
  end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', first_uid, 'session_id', first_session,
    'role', 'authenticated', 'aud', 'authenticated', 'exp', floor(extract(epoch from statement_timestamp())) + 3600)::text, true);
  perform set_config('request.headers', '{}', true);
  perform pg_temp.check_bootstrap('unassigned_no_automatic_account', '{"state":"onboarding_required"}');
  if exists(select 1 from kaq_private.learning_accounts) or exists(select 1 from kaq_private.learning_memberships)
    or exists(select 1 from kaq_private.learning_session_grants) then raise exception 'Bootstrap wrote ownership'; end if;
  insert into bootstrap_checks values('onboarding_side_effects_zero');

  insert into kaq_private.learning_accounts(id) values(first_uid), (second_uid);
  insert into kaq_private.learning_memberships(auth_user_id, account_id) values(first_uid, first_uid), (second_uid, second_uid);
  insert into public.learning_state(user_id) values(first_uid), (second_uid) on conflict do nothing;
  update public.learning_state set generation = 7 where user_id = first_uid;
  insert into kaq_private.learning_session_grants(session_id, auth_user_id, account_id, membership_epoch, reason)
    values(first_session, first_uid, first_uid, 0, 'legacy');
  ready := jsonb_build_object('state', 'ready', 'account_id', first_uid, 'membership_epoch', 0, 'generation', 7);
  select created_at into first_created from auth.sessions where id = first_session;
  select jsonb_build_object('accounts', (select jsonb_agg(to_jsonb(r) order by id) from kaq_private.learning_accounts r),
    'memberships', (select jsonb_agg(to_jsonb(r) order by auth_user_id) from kaq_private.learning_memberships r),
    'grants', (select jsonb_agg(to_jsonb(r) order by session_id) from kaq_private.learning_session_grants r),
    'state', (select jsonb_agg(to_jsonb(r) order by user_id) from public.learning_state r)) into before_snapshot;
  perform pg_temp.check_bootstrap('ready_without_scope_header', ready);
  perform pg_temp.mutate_bootstrap('untrusted_header_never_selects_other_owner', format(
    'select set_config(''request.headers'', %L, true)', jsonb_build_object('x-kaq-account-id', second_uid)::text), ready);
  perform pg_temp.mutate_bootstrap('inactive_membership_no_scope', format(
    'update kaq_private.learning_memberships set status = ''detached'' where auth_user_id = %L', first_uid), '{"state":"disabled"}');
  perform pg_temp.mutate_bootstrap('disabled_membership_no_scope', format(
    'update kaq_private.learning_memberships set status = ''disabled'' where auth_user_id = %L', first_uid), '{"state":"disabled"}');
  perform pg_temp.mutate_bootstrap('inactive_account_no_scope', format(
    'update kaq_private.learning_accounts set status = ''deleting'' where id = %L', first_uid), '{"state":"disabled"}');
  for case_row in select * from (values
    ('missing_grant', format('delete from kaq_private.learning_session_grants where session_id = %L', first_session)),
    ('revoked_grant', format('update kaq_private.learning_session_grants set revoked_at = clock_timestamp() where session_id = %L', first_session)),
    ('old_epoch', format('update kaq_private.learning_memberships set epoch = 1 where auth_user_id = %L', first_uid)),
    ('new_account_fence', format('update kaq_private.learning_accounts set session_fence_at = clock_timestamp() where id = %L', first_uid)),
    ('new_membership_fence', format('update kaq_private.learning_memberships set session_fence_at = clock_timestamp() where auth_user_id = %L', first_uid)),
    ('invalid_fence', format('update kaq_private.learning_accounts set session_fence_at = ''infinity'' where id = %L', first_uid))
  ) inputs(label, statement) loop
    perform pg_temp.mutate_bootstrap(case_row.label, case_row.statement, '{"state":"reauthentication_required"}');
  end loop;
  if has_grant_member_account_fk then
    perform pg_temp.mutate_bootstrap('wrong_account_grant', format(
      'update kaq_private.learning_session_grants set account_id = %L where session_id = %L', second_uid, first_session), null,
      'learning_session_grants_member_account_fkey');
    perform pg_temp.mutate_bootstrap('wrong_actor_grant', format(
      'update kaq_private.learning_session_grants set auth_user_id = %L where session_id = %L', second_uid, first_session), null,
      'learning_session_grants_member_account_fkey');
  else
    perform pg_temp.mutate_bootstrap('wrong_account_grant', format(
      'update kaq_private.learning_session_grants set account_id = %L where session_id = %L', second_uid, first_session),
      '{"state":"reauthentication_required"}');
    perform pg_temp.mutate_bootstrap('wrong_actor_grant', format(
      'update kaq_private.learning_session_grants set auth_user_id = %L where session_id = %L', second_uid, first_session),
      '{"state":"reauthentication_required"}');
  end if;
  perform pg_temp.mutate_bootstrap('fresh_after_fence_existing_grant', format(
    'update kaq_private.learning_accounts set session_fence_at = %L where id = %L', first_created - interval '1 second', first_uid), ready);
  for case_row in select * from (values
    ('account_session_equal', 'learning_accounts', 'id', first_created, first_created + interval '1 second'),
    ('account_oauth_equal', 'learning_accounts', 'id', first_created - interval '1 second', first_created - interval '1 second'),
    ('account_both_equal', 'learning_accounts', 'id', first_created, first_created),
    ('membership_session_equal', 'learning_memberships', 'auth_user_id', first_created, first_created + interval '1 second'),
    ('membership_oauth_equal', 'learning_memberships', 'auth_user_id', first_created - interval '1 second', first_created - interval '1 second'),
    ('membership_both_equal', 'learning_memberships', 'auth_user_id', first_created, first_created)
  ) boundaries(label, relation, owner_column, fence, oauth) loop
    perform pg_temp.mutate_bootstrap(case_row.label, format(
      'update kaq_private.%I set session_fence_at = %L where %I = %L;
       update auth.mfa_amr_claims set updated_at = %L where session_id = %L and authentication_method = ''oauth''',
      case_row.relation, case_row.fence, case_row.owner_column, first_uid, case_row.oauth, first_session),
      '{"state":"reauthentication_required"}');
  end loop;
  for case_row in select * from (values
    ('fenced_missing_oauth', format('delete from auth.mfa_amr_claims where session_id = %L and authentication_method = ''oauth''', first_session)),
    ('fenced_old_oauth', format('update auth.mfa_amr_claims set updated_at = %L where session_id = %L and authentication_method = ''oauth''', first_created - interval '2 seconds', first_session)),
    ('fenced_invalid_oauth', format('update auth.mfa_amr_claims set updated_at = ''infinity'' where session_id = %L and authentication_method = ''oauth''', first_session))
  ) inputs(label, statement) loop
    perform pg_temp.mutate_bootstrap(case_row.label, format(
      'update kaq_private.learning_accounts set session_fence_at = %L where id = %L; %s',
      first_created - interval '1 second', first_uid, case_row.statement), '{"state":"reauthentication_required"}');
  end loop;
  perform pg_temp.mutate_bootstrap('shared_account_requires_no_extra_learning_account', format(
    'delete from kaq_private.learning_session_grants where session_id = %L;
     update kaq_private.learning_memberships set account_id = %L, epoch = 3 where auth_user_id = %L;
     insert into kaq_private.learning_session_grants(session_id, auth_user_id, account_id, membership_epoch, reason)
       values(%L, %L, %L, 3, ''reauthenticated'')',
    first_session, second_uid, first_uid, first_session, first_uid, second_uid), jsonb_build_object('state', 'ready', 'account_id', second_uid,
      'membership_epoch', 3, 'generation', (select generation from public.learning_state where user_id = second_uid)));
  begin
    delete from public.learning_state where user_id = first_uid;
    perform kaq_private.read_account_bootstrap();
    raise exception 'Missing state silently accepted';
  exception when sqlstate 'PT500' then null;
  end;
  insert into bootstrap_checks values('missing_active_state_is_invariant_error');
  select jsonb_build_object('accounts', (select jsonb_agg(to_jsonb(r) order by id) from kaq_private.learning_accounts r),
    'memberships', (select jsonb_agg(to_jsonb(r) order by auth_user_id) from kaq_private.learning_memberships r),
    'grants', (select jsonb_agg(to_jsonb(r) order by session_id) from kaq_private.learning_session_grants r),
    'state', (select jsonb_agg(to_jsonb(r) order by user_id) from public.learning_state r)) into after_snapshot;
  if after_snapshot is distinct from before_snapshot then raise exception 'Read-only bootstrap mutated ownership or state'; end if;
  insert into bootstrap_checks values('all_rows_unchanged');
  for case_row in select rolname from pg_roles where rolname in ('anon', 'authenticated', 'service_role') loop
    if has_function_privilege(case_row.rolname, 'kaq_private.read_account_bootstrap()', 'EXECUTE') then
      raise exception 'Bootstrap leaked EXECUTE to %', case_row.rolname;
    end if;
    insert into bootstrap_checks values('private_execute_denied_' || case_row.rolname);
  end loop;
end $$;
select json_build_object('status', 'passed', 'checks', json_agg(name order by name),
  'scope', 'read_only_private_bootstrap', 'publicApiExposed', false) from bootstrap_checks;
rollback;
