import { writeFileSync } from 'node:fs';
import { sql } from './commands';
import { publicSchemaQuery } from './public-state';
import { artifacts } from './settings';

const cases = [
  [
    'trigger',
    'alter table public.published_fundamentals_catalogs disable trigger published_fundamentals_catalogs_append_only',
  ],
  ['table_owner', 'alter table public.learning_state owner to postgres'],
  ['function_owner', 'alter function public.require_learning_user() owner to postgres'],
  ['schema_owner', 'alter schema public owner to postgres'],
  ['column_acl', 'grant select(selected) on public.learning_events to anon'],
  ['table_acl', 'revoke select on public.learning_state from authenticated'],
  ['function_acl', 'revoke execute on function public.initialize_learning_state() from authenticated'],
  [
    'policy_permissive',
    'drop policy learning_events_read on public.learning_events; create policy learning_events_read on public.learning_events as restrictive for select to authenticated using (user_id = auth.uid())',
  ],
  ['default_acl', 'alter default privileges in schema public grant select on tables to anon'],
  ['rls', 'alter table public.learning_state disable row level security'],
  ['function_security', 'alter function public.require_learning_user() security invoker'],
  ['index', 'drop index public.learning_events_user_answered_idx'],
  ['constraint', 'alter table public.learning_events drop constraint learning_events_duration_ms_check'],
  ['column_default', 'alter table public.learning_state alter column generation set default 7'],
  ['relation_inventory', 'create table public.boundary_unexpected(id integer)'],
  [
    'function_inventory',
    "create function public.boundary_unexpected() returns integer language sql as 'select 1'",
  ],
] as const;

export function verifyPublicSchemaGuards() {
  if (publicSchemaQuery.includes('$schema_guard$'))
    throw new Error('Schema verifier delimiter collision');
  const statements = cases.map(
    ([name, statement]) =>
      `select pg_temp.expect_schema_change('${name}', '${statement.replaceAll("'", "''")}');`,
  );
  const result = sql(`begin;
    create temporary table schema_guard_results(name text primary key) on commit drop;
    create function pg_temp.public_schema_snapshot() returns text language sql volatile
      as $schema_guard$ ${publicSchemaQuery} $schema_guard$;
    create function pg_temp.expect_schema_change(label text, statement text) returns void language plpgsql as $$
    declare baseline text := pg_temp.public_schema_snapshot();
    begin
      begin
        execute statement;
        if pg_temp.public_schema_snapshot() = baseline then
          raise exception 'Schema verifier missed: %', label;
        end if;
        raise exception using errcode = 'ZB001';
      exception when sqlstate 'ZB001' then null;
      end;
      if pg_temp.public_schema_snapshot() <> baseline then
        raise exception 'Schema guard failed to rollback: %', label;
      end if;
      insert into schema_guard_results values(label);
    end $$;
    ${statements.join('\n')}
    select jsonb_build_object('status','passed','cases',jsonb_agg(name order by name)) from schema_guard_results;
    rollback;`);
  const receipt = result.split('\n').find((line) => line.startsWith('{'));
  if (!receipt) throw new Error('Schema guards did not return a receipt');
  const proof: { status: string; cases: string[] } = JSON.parse(receipt);
  if (proof.status !== 'passed' || proof.cases.length !== cases.length)
    throw new Error('Schema guards are incomplete');
  writeFileSync(`${artifacts}/schema-guards.json`, JSON.stringify(proof, null, 2));
}
