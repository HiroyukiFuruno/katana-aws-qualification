-- 実migration roleで作り、既定ACLを信じずprivate全functionの実効権限を検査する。
begin;
create temporary table private_acl_checks (name text primary key) on commit drop;
create function pg_temp.private_function_leaks() returns text[] language sql stable as $$
  select coalesce(array_agg(p.oid::regprocedure::text order by p.oid::regprocedure::text), array[]::text[])
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'kaq_private' and (
    exists(select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
      where a.grantee = 0 and a.privilege_type = 'EXECUTE')
    or has_function_privilege('anon', p.oid, 'EXECUTE')
    or has_function_privilege('service_role', p.oid, 'EXECUTE')
    or has_function_privilege('authenticated', p.oid, 'EXECUTE')
      <> (p.oid = 'kaq_private.read_learning_account()'::regprocedure)
  )
$$;
do $$ begin
  if cardinality(pg_temp.private_function_leaks()) <> 0 then
    raise exception 'Private function ACL leaked: %', pg_temp.private_function_leaks();
  end if;
  insert into private_acl_checks values('all_private_functions_minimal_effective_acl');
end $$;

create function kaq_private.scope_acl_canary() returns integer language sql as $$ select 1 $$;
revoke all on function kaq_private.scope_acl_canary() from public, anon, authenticated, service_role;
create table kaq_private.scope_acl_canary_table(id integer);
revoke all on table kaq_private.scope_acl_canary_table from public, anon, authenticated, service_role;
create sequence kaq_private.scope_acl_canary_sequence;
revoke all on sequence kaq_private.scope_acl_canary_sequence from public, anon, authenticated, service_role;
do $$
declare role_name text;
begin
  if cardinality(pg_temp.private_function_leaks()) <> 0 then raise exception 'Explicit revoke failed'; end if;
  insert into private_acl_checks values('actual_creation_role_explicit_revoke_closed');
  grant execute on function kaq_private.scope_acl_canary() to public;
  if pg_temp.private_function_leaks() <> array['kaq_private.scope_acl_canary()'] then
    raise exception 'PUBLIC execute negative canary escaped inventory';
  end if;
  insert into private_acl_checks values('public_execute_leak_detected');
  revoke all on function kaq_private.scope_acl_canary() from public;
  foreach role_name in array array['anon', 'authenticated', 'service_role'] loop
    if has_table_privilege(role_name, 'kaq_private.scope_acl_canary_table', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      or has_sequence_privilege(role_name, 'kaq_private.scope_acl_canary_sequence', 'USAGE,SELECT,UPDATE') then
      raise exception 'Canary table/sequence grant leaked to %', role_name;
    end if;
    insert into private_acl_checks values('table_sequence_denied_' || role_name);
  end loop;
  if cardinality(pg_temp.private_function_leaks()) <> 0 then raise exception 'Canary revoke not restored'; end if;
  insert into private_acl_checks values('negative_canary_revoked');
end $$;
select json_build_object('status', 'passed', 'checks', json_agg(name order by name),
  'creationRole', current_user, 'scope', 'private_effective_acl_inventory') from private_acl_checks;
rollback;
