create schema if not exists auth authorization supabase_auth_admin;
create schema if not exists extensions authorization supabase_auth_admin;
create role postgres nologin;
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
create role authenticator login noinherit password 'integration-only';
grant anon, authenticated, service_role to authenticator;
grant usage on schema auth, public to anon, authenticated, service_role;
grant all on schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant all on functions to service_role;

-- Supabaseと同じclaim bridgeを使い、tokenと実sessionはGoTrueで発行する。
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  )::uuid
$$;
revoke all on function auth.uid() from public;
grant execute on function auth.uid() to anon, authenticated, service_role;
