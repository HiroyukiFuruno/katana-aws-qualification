-- 未登録。public RLS/readerへ接続する前に、17の共通grant検証とlegacy/header境界を揃える。
create function kaq_private.read_public_learning_scope() returns jsonb
language plpgsql stable security definer
set search_path = pg_catalog, auth, public, kaq_private
as $$
declare context jsonb; current_grant jsonb; member kaq_private.learning_memberships%rowtype;
  account kaq_private.learning_accounts%rowtype; generation bigint;
begin
  context := kaq_private.lock_request_context();
  current_grant := kaq_private.resolve_current_learning_grant();
  select * into member from kaq_private.learning_memberships
    where auth_user_id = (context->>'actor_uid')::uuid;
  select * into account from kaq_private.learning_accounts where id = (current_grant->>'account_id')::uuid;
  if member.auth_user_id is null or account.id is null or member.account_id is distinct from account.id
    or member.epoch is distinct from (current_grant->>'membership_epoch')::bigint then
    raise exception using errcode = 'PT403', message = 'KAQ_SCOPE_INVALID';
  end if;
  if (context->>'bound')::boolean then
    if (context->>'expected_account')::uuid is distinct from account.id
      or (context->>'expected_epoch')::bigint is distinct from member.epoch then
      raise exception using errcode = 'PT403', message = 'KAQ_SCOPE_INVALID';
    end if;
  elsif account.id is distinct from (context->>'actor_uid')::uuid
    or member.epoch <> 0 or account.membership_revision <> 0
    or account.session_fence_at is not null or member.session_fence_at is not null
    or current_grant->>'reason' <> 'legacy'
    or exists(select 1 from kaq_private.learning_memberships other
      where other.account_id = account.id and other.auth_user_id <> member.auth_user_id) then
    raise exception using errcode = 'PT403', message = 'KAQ_SCOPE_INVALID';
  end if;
  select state.generation into generation from public.learning_state state where state.user_id = account.id;
  if not found then raise exception using errcode = 'PT500', message = 'KAQ_ACCOUNT_STATE_MISSING'; end if;
  return jsonb_build_object('account_id',account.id,'membership_epoch',member.epoch,'generation',generation);
end $$;
revoke all on function kaq_private.read_public_learning_scope() from public, anon, authenticated, service_role;

create or replace function kaq_private.read_learning_account() returns uuid
language sql stable security definer set search_path = pg_catalog, kaq_private
as $$ select (kaq_private.read_public_learning_scope()->>'account_id')::uuid $$;
revoke all on function kaq_private.read_learning_account() from public, anon, authenticated, service_role;
grant execute on function kaq_private.read_learning_account() to authenticated;

create or replace function kaq_private.read_account_bootstrap() returns jsonb
language plpgsql stable security definer
set search_path = pg_catalog, auth, public, kaq_private
as $$
declare context jsonb; actor auth.sessions%rowtype; member kaq_private.learning_memberships%rowtype;
  account kaq_private.learning_accounts%rowtype; current_grant jsonb; generation bigint;
begin
  context := kaq_private.lock_request_context();
  actor := kaq_private.read_actor_session();
  select * into member from kaq_private.learning_memberships where auth_user_id = actor.user_id;
  if not found then return jsonb_build_object('state','onboarding_required'); end if;
  select * into account from kaq_private.learning_accounts where id = member.account_id;
  if member.status <> 'active' or account.id is null or account.status <> 'active' then
    return jsonb_build_object('state','disabled');
  end if;
  begin
    current_grant := kaq_private.resolve_current_learning_grant();
  exception when sqlstate 'PT401' then
    return jsonb_build_object('state','reauthentication_required');
  end;
  if (current_grant->>'account_id')::uuid is distinct from member.account_id
    or (current_grant->>'membership_epoch')::bigint is distinct from member.epoch then
    raise exception using errcode = 'PT403', message = 'KAQ_SCOPE_INVALID';
  end if;
  if (context->>'bound')::boolean then
    if (context->>'expected_account')::uuid is distinct from account.id
      or (context->>'expected_epoch')::bigint is distinct from member.epoch then
      raise exception using errcode = 'PT403', message = 'KAQ_SCOPE_INVALID';
    end if;
  end if;
  select state.generation into generation from public.learning_state state where state.user_id = account.id;
  if not found then raise exception using errcode = 'PT500', message = 'KAQ_ACCOUNT_STATE_MISSING'; end if;
  return jsonb_build_object('state','ready','account_id',account.id,'membership_epoch',member.epoch,'generation',generation);
end $$;
revoke all on function kaq_private.read_account_bootstrap() from public, anon, authenticated, service_role;
