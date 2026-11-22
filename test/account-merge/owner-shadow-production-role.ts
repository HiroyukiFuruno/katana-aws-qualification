import { sql } from './commands';

const setup = `begin;
create schema supabase_migrations authorization supabase_auth_admin;
create table supabase_migrations.schema_migrations(version text primary key,name text not null,statements text[]);
alter role postgres nosuperuser bypassrls inherit createdb createrole;
grant postgres to supabase_auth_admin;
grant usage on schema auth,public,kaq_private,extensions,supabase_migrations to postgres;
grant select,insert,update,delete on all tables in schema auth,public,kaq_private,supabase_migrations to postgres;
grant usage,select on all sequences in schema public,kaq_private to postgres;
grant execute on all functions in schema extensions to postgres;
commit;`;
const cleanup = `begin;
revoke all on all functions in schema extensions from postgres;
revoke all on all sequences in schema public,kaq_private from postgres;
revoke all on all tables in schema auth,public,kaq_private,supabase_migrations from postgres;
revoke usage on schema auth,public,kaq_private,extensions,supabase_migrations from postgres;
revoke postgres from supabase_auth_admin;
alter role postgres nosuperuser nobypassrls noinherit nocreatedb nocreaterole;
drop schema supabase_migrations cascade;
commit;`;

export function setupProductionRoleFixture() {
  sql(setup);
}

export function cleanupProductionRoleFixture() {
  sql(cleanup);
}
