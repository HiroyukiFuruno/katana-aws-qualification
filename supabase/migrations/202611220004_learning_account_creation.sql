-- #58 createNew の private 基盤。公開 RPC/RLS/FK/client/callback には未接続。
begin;
set transaction isolation level serializable;

create table kaq_private.learning_account_creation_receipts (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  request_key uuid not null check (request_key <> '00000000-0000-0000-0000-000000000000'::uuid),
  session_id uuid not null references auth.sessions(id) on delete cascade,
  account_id uuid not null references kaq_private.learning_accounts(id),
  membership_epoch bigint not null check (membership_epoch = 0),
  generation bigint not null check (generation = 0),
  created_at timestamptz not null default clock_timestamp()
);
alter table kaq_private.learning_account_creation_receipts enable row level security;
revoke all on table kaq_private.learning_account_creation_receipts from public, anon, authenticated, service_role;

create function kaq_private.create_learning_account(p_consent boolean, p_request_key uuid) returns jsonb
language plpgsql volatile security definer
set search_path = pg_catalog, auth, public, kaq_private
as $$
declare
  initial_context jsonb; final_context jsonb; actor_uid uuid; actor_session_id uuid;
  live_session auth.sessions%rowtype; account kaq_private.learning_accounts%rowtype;
  membership kaq_private.learning_memberships%rowtype; grant_row kaq_private.learning_session_grants%rowtype;
  receipt kaq_private.learning_account_creation_receipts%rowtype; oauth_at timestamptz;
  state_generation bigint; has_public_owner boolean; has_live_session boolean := false;
begin
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception using errcode = 'PT400', message = 'KAQ_SCOPE_ISOLATION_UNSUPPORTED';
  end if;
  if p_consent is distinct from true or p_request_key is null
    or p_request_key = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception using errcode = 'PT400', message = 'KAQ_ACCOUNT_CREATION_ARGUMENT_INVALID';
  end if;
  initial_context := kaq_private.lock_request_context();
  actor_uid := (initial_context ->> 'actor_uid')::uuid;
  actor_session_id := (initial_context ->> 'session_id')::uuid;
  perform 1 from auth.users where id = actor_uid for update;
  if not found then raise exception using errcode = '28000', message = 'KAQ_SESSION_INVALID'; end if;
  begin
    select * into live_session from auth.sessions where id = actor_session_id for share nowait;
    has_live_session := found;
    select updated_at into oauth_at from auth.mfa_amr_claims where session_id = actor_session_id
      and authentication_method = 'oauth' for share nowait;
  exception when lock_not_available then
    raise exception using errcode = 'PT409', message = 'KAQ_SCOPE_RETRY';
  end;
  if not has_live_session or live_session.user_id is distinct from actor_uid then
    raise exception using errcode = '28000', message = 'KAQ_SESSION_INVALID';
  end if;
  live_session := kaq_private.assert_live_session(actor_uid, actor_session_id, false);
  if oauth_at is null or not isfinite(oauth_at) or oauth_at > clock_timestamp() + interval '5 seconds' then
    raise exception using errcode = 'PT401', message = 'KAQ_REAUTHENTICATION_REQUIRED';
  end if;
  select generation into state_generation from public.learning_state where user_id = actor_uid for update;
  select * into receipt from kaq_private.learning_account_creation_receipts where auth_user_id = actor_uid for update;
  select * into account from kaq_private.learning_accounts where id = actor_uid for update;
  select * into membership from kaq_private.learning_memberships where auth_user_id = actor_uid for update;
  select * into grant_row from kaq_private.learning_session_grants where session_id = actor_session_id for update;
  select exists(
    select 1 from public.learning_state where user_id = actor_uid union all
    select 1 from public.learning_events where user_id = actor_uid union all
    select 1 from public.exam_sessions where user_id = actor_uid union all
    select 1 from public.exam_responses where user_id = actor_uid union all
    select 1 from public.earned_certifications where user_id = actor_uid union all
    select 1 from public.assessment_answers where user_id = actor_uid union all
    select 1 from public.roadmap_profiles where user_id = actor_uid union all
    select 1 from public.migration_manifests where user_id = actor_uid union all
    select 1 from public.migration_items where user_id = actor_uid union all
    select 1 from public.fundamentals_unit_progress where user_id = actor_uid union all
    select 1 from public.fundamentals_final_sessions where user_id = actor_uid union all
    select 1 from public.dashboard_settings where user_id = actor_uid
  ) into has_public_owner;
  if receipt.auth_user_id is not null then
    if receipt.request_key is distinct from p_request_key or receipt.session_id is distinct from actor_session_id
      or receipt.account_id is distinct from actor_uid or receipt.membership_epoch <> 0 or receipt.generation <> 0
      or account.status <> 'active' or account.membership_revision <> 0 or account.session_fence_at is not null
      or membership.account_id is distinct from receipt.account_id or membership.status <> 'active' or membership.epoch <> 0
      or membership.session_fence_at is not null or grant_row.auth_user_id is distinct from actor_uid
      or grant_row.account_id is distinct from receipt.account_id or grant_row.membership_epoch <> 0
      or grant_row.reason <> 'created' or grant_row.proof_id is not null or grant_row.revoked_at is not null
      or state_generation is distinct from 0 then
      raise exception using errcode = 'PT409', message = 'KAQ_ACCOUNT_CREATION_CONFLICT';
    end if;
  elsif membership.auth_user_id is not null or account.id is not null or grant_row.session_id is not null or has_public_owner then
    raise exception using errcode = 'PT409', message = 'KAQ_ACCOUNT_CREATION_CONFLICT';
  else
    insert into kaq_private.learning_accounts(id) values(actor_uid);
    insert into kaq_private.learning_memberships(auth_user_id, account_id) values(actor_uid, actor_uid);
    insert into public.learning_state(user_id, generation) values(actor_uid, 0);
    insert into kaq_private.learning_session_grants(session_id, auth_user_id, account_id, membership_epoch, reason)
      values(actor_session_id, actor_uid, actor_uid, 0, 'created');
    insert into kaq_private.learning_account_creation_receipts(auth_user_id, request_key, session_id, account_id, membership_epoch, generation)
      values(actor_uid, p_request_key, actor_session_id, actor_uid, 0, 0) returning * into receipt;
  end if;
  final_context := kaq_private.lock_request_context();
  if final_context is distinct from initial_context then
    raise exception using errcode = '28000', message = 'KAQ_AUTH_CONTEXT_INVALID';
  end if;
  live_session := kaq_private.assert_live_session(actor_uid, actor_session_id, false);
  select updated_at into oauth_at from auth.mfa_amr_claims where session_id = actor_session_id
    and authentication_method = 'oauth' for share;
  select * into account from kaq_private.learning_accounts where id = receipt.account_id for share;
  select * into membership from kaq_private.learning_memberships where auth_user_id = actor_uid for share;
  select * into grant_row from kaq_private.learning_session_grants where session_id = actor_session_id for share;
  select generation into state_generation from public.learning_state where user_id = receipt.account_id for share;
  if oauth_at is null or not isfinite(oauth_at) or oauth_at > clock_timestamp() + interval '5 seconds'
    or account.id is null or account.status <> 'active' or account.membership_revision <> 0 or account.session_fence_at is not null
    or membership.auth_user_id is null or membership.account_id is distinct from receipt.account_id
    or membership.status <> 'active' or membership.epoch <> 0 or membership.session_fence_at is not null
    or grant_row.session_id is null or grant_row.auth_user_id is distinct from actor_uid
    or grant_row.account_id is distinct from receipt.account_id or grant_row.membership_epoch <> 0
    or grant_row.reason <> 'created' or grant_row.proof_id is not null or grant_row.revoked_at is not null
    or state_generation is distinct from 0 then
    raise exception using errcode = 'PT401', message = 'KAQ_REAUTHENTICATION_REQUIRED';
  end if;
  return jsonb_build_object('receipt_id', receipt.id, 'account_id', receipt.account_id,
    'membership_epoch', receipt.membership_epoch, 'generation', receipt.generation);
end $$;
revoke all on function kaq_private.create_learning_account(boolean, uuid) from public, anon, authenticated, service_role;

commit;
