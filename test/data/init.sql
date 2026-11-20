create schema if not exists auth authorization supabase_auth_admin;
create schema if not exists extensions authorization supabase_auth_admin;
create role postgres nologin;
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
create role authenticator login noinherit password 'integration-only';
grant anon, authenticated, service_role to authenticator;
grant usage on schema auth, public to anon, authenticated;

-- Supabaseのauth.uid()と同じJWT claim bridge。実ユーザーとtokenはGoTrue APIが発行する。
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  )::uuid
$$;
revoke all on function auth.uid() from public;
grant execute on function auth.uid() to anon, authenticated;
