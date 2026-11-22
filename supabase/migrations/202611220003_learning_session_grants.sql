-- #58 の private session grant 契約。公開 RPC/RLS/FK/client はこの migration で変更しない。
begin;
set transaction isolation level serializable;

alter table kaq_private.learning_memberships
  add constraint learning_memberships_auth_account_unique unique (auth_user_id, account_id);

alter table kaq_private.account_proofs
  add constraint account_proofs_binding_identity_unique unique (id, intent_id, auth_uid, session_id);

alter table kaq_private.account_merge_receipts
  add constraint account_merge_receipts_binding_identity_unique unique (id, intent_id, canonical_account_id);

alter table kaq_private.learning_session_grants
  add column proof_id uuid,
  add constraint learning_session_grants_member_account_fkey
    foreign key (auth_user_id, account_id)
    references kaq_private.learning_memberships(auth_user_id, account_id),
  add constraint learning_session_grants_proof_shape_check check (
    (reason = 'proof' and proof_id is not null)
    or (reason <> 'proof' and proof_id is null)
  );

create table kaq_private.account_committed_proof_bindings (
  proof_id uuid primary key,
  receipt_id uuid not null,
  intent_id uuid not null,
  auth_user_id uuid not null,
  session_id uuid not null,
  canonical_account_id uuid not null,
  membership_epoch bigint not null check (membership_epoch >= 0),
  account_fence_at timestamptz,
  membership_fence_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  unique (proof_id, auth_user_id, session_id, canonical_account_id, membership_epoch),
  foreign key (proof_id, intent_id, auth_user_id, session_id)
    references kaq_private.account_proofs(id, intent_id, auth_uid, session_id),
  foreign key (receipt_id, intent_id, canonical_account_id)
    references kaq_private.account_merge_receipts(id, intent_id, canonical_account_id),
  foreign key (auth_user_id, canonical_account_id)
    references kaq_private.learning_memberships(auth_user_id, account_id)
);
alter table kaq_private.account_committed_proof_bindings enable row level security;
revoke all on table kaq_private.account_committed_proof_bindings from public, anon, authenticated, service_role;

create function kaq_private.validate_account_committed_proof_binding() returns trigger
language plpgsql security definer
set search_path = pg_catalog, auth, kaq_private
as $$
declare
  proof kaq_private.account_proofs%rowtype;
  receipt kaq_private.account_merge_receipts%rowtype;
  intent kaq_private.account_intents%rowtype;
  member kaq_private.learning_memberships%rowtype;
  account kaq_private.learning_accounts%rowtype;
begin
  perform kaq_private.assert_live_session(new.auth_user_id, new.session_id, false);
  select * into proof from kaq_private.account_proofs where id = new.proof_id for share;
  select * into intent from kaq_private.account_intents where id = new.intent_id for share;
  select * into receipt from kaq_private.account_merge_receipts where id = new.receipt_id for share;
  select * into member from kaq_private.learning_memberships where auth_user_id = new.auth_user_id for share;
  select * into account from kaq_private.learning_accounts where id = new.canonical_account_id for share;
  if proof.id is null or receipt.id is null or intent.id is null or member.auth_user_id is null or account.id is null
    or proof.intent_id is distinct from new.intent_id or proof.auth_uid is distinct from new.auth_user_id
    or proof.session_id is distinct from new.session_id or proof.consumed_at is null
    or intent.state <> 'committed' or receipt.intent_id is distinct from new.intent_id
    or receipt.canonical_account_id is distinct from new.canonical_account_id
    or member.account_id is distinct from new.canonical_account_id or member.epoch is distinct from new.membership_epoch
    or account.status <> 'active' or member.status <> 'active'
    or (new.account_fence_at is not null and not isfinite(new.account_fence_at))
    or (new.membership_fence_at is not null and not isfinite(new.membership_fence_at))
    or not (account.session_fence_at is not distinct from new.account_fence_at)
    or not (member.session_fence_at is not distinct from new.membership_fence_at) then
    raise exception using errcode = 'PT401', message = 'KAQ_PROOF_BINDING_INVALID';
  end if;
  return new;
end $$;
revoke all on function kaq_private.validate_account_committed_proof_binding() from public, anon, authenticated, service_role;

create trigger account_committed_proof_bindings_validate
  before insert or update on kaq_private.account_committed_proof_bindings
  for each row execute function kaq_private.validate_account_committed_proof_binding();

alter table kaq_private.learning_session_grants
  add constraint learning_session_grants_proof_binding_fkey
    foreign key (proof_id, auth_user_id, session_id, account_id, membership_epoch)
    references kaq_private.account_committed_proof_bindings(
      proof_id, auth_user_id, session_id, canonical_account_id, membership_epoch
    );

create function kaq_private.issue_learning_session_grant(
  p_reason text, p_proof_id uuid default null, p_receipt_id uuid default null
) returns jsonb language plpgsql volatile security definer
set search_path = pg_catalog, auth, public, kaq_private
as $$
declare
  initial_context jsonb; final_context jsonb;
  actor_uid uuid; actor_session_id uuid; initial_account_id uuid; initial_proof_intent_id uuid;
  live_session auth.sessions%rowtype;
  member kaq_private.learning_memberships%rowtype;
  account kaq_private.learning_accounts%rowtype;
  grant_row kaq_private.learning_session_grants%rowtype;
  proof kaq_private.account_proofs%rowtype;
  receipt kaq_private.account_merge_receipts%rowtype;
  intent kaq_private.account_intents%rowtype;
  binding kaq_private.account_committed_proof_bindings%rowtype;
  oauth_at timestamptz; fence_at timestamptz;
begin
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception using errcode = 'PT400', message = 'KAQ_SCOPE_ISOLATION_UNSUPPORTED';
  end if;
  if p_reason is null or p_reason not in ('reauthenticated', 'proof')
    or (p_reason = 'reauthenticated' and (p_proof_id is not null or p_receipt_id is not null))
    or (p_reason = 'proof' and (p_proof_id is null or p_receipt_id is null)) then
    raise exception using errcode = 'PT400', message = 'KAQ_GRANT_ARGUMENT_INVALID';
  end if;
  -- proof は intent を先行 SHARE してから Auth/session/state を固定する。normal に intent lock は不要。
  if p_reason = 'proof' then
    select intent_id into initial_proof_intent_id from kaq_private.account_proofs where id = p_proof_id;
    if not found then raise exception using errcode = 'PT401', message = 'KAQ_REAUTHENTICATION_REQUIRED'; end if;
    select * into intent from kaq_private.account_intents where id = initial_proof_intent_id for share;
    if not found then raise exception using errcode = 'PT401', message = 'KAQ_REAUTHENTICATION_REQUIRED'; end if;
  end if;
  initial_context := kaq_private.lock_request_context();
  actor_uid := (initial_context ->> 'actor_uid')::uuid;
  actor_session_id := (initial_context ->> 'session_id')::uuid;
  select account_id into initial_account_id from kaq_private.learning_memberships where auth_user_id = actor_uid;
  if not found then raise exception using errcode = 'PT409', message = 'KAQ_ONBOARDING_REQUIRED'; end if;

  perform 1 from auth.users where id = actor_uid for share;
  if not found then raise exception using errcode = '28000', message = 'KAQ_SESSION_INVALID'; end if;
  begin
    select * into live_session from auth.sessions where id = actor_session_id for share nowait;
  exception when lock_not_available then
    raise exception using errcode = 'PT409', message = 'KAQ_SCOPE_RETRY';
  end;
  if not found or live_session.user_id is distinct from actor_uid then
    raise exception using errcode = '28000', message = 'KAQ_SESSION_INVALID';
  end if;
  begin
    perform 1 from auth.mfa_amr_claims where session_id = actor_session_id
      order by authentication_method for share nowait;
  exception when lock_not_available then
    raise exception using errcode = 'PT409', message = 'KAQ_SCOPE_RETRY';
  end;
  perform 1 from public.learning_state where user_id = initial_account_id for share;
  if not found then raise exception using errcode = 'PT409', message = 'KAQ_STATE_UNAVAILABLE'; end if;
  select * into account from kaq_private.learning_accounts where id = initial_account_id for share;
  select * into member from kaq_private.learning_memberships where auth_user_id = actor_uid for share;
  if not found or member.account_id is distinct from initial_account_id then
    raise exception using errcode = 'PT409', message = 'KAQ_SCOPE_RETRY';
  end if;
  final_context := kaq_private.lock_request_context();
  if final_context is distinct from initial_context then
    raise exception using errcode = '28000', message = 'KAQ_AUTH_CONTEXT_INVALID';
  end if;
  live_session := kaq_private.assert_live_session(actor_uid, actor_session_id, false);
  if account.status <> 'active' or member.status <> 'active' then
    raise exception using errcode = 'PT403', message = 'KAQ_ACCOUNT_DISABLED';
  end if;
  if (account.session_fence_at is not null and not isfinite(account.session_fence_at))
    or (member.session_fence_at is not null and not isfinite(member.session_fence_at)) then
    raise exception using errcode = 'PT401', message = 'KAQ_REAUTHENTICATION_REQUIRED';
  end if;

  if p_reason = 'reauthenticated' then
    select updated_at into oauth_at from auth.mfa_amr_claims
      where session_id = actor_session_id and authentication_method = 'oauth' for share;
    if oauth_at is null or not isfinite(oauth_at) or oauth_at > clock_timestamp() + interval '5 seconds' then
      raise exception using errcode = 'PT401', message = 'KAQ_REAUTHENTICATION_REQUIRED';
    end if;
    fence_at := greatest(account.session_fence_at, member.session_fence_at);
    if fence_at is not null and (
      live_session.created_at <= fence_at or oauth_at <= fence_at
    ) then
      raise exception using errcode = 'PT401', message = 'KAQ_REAUTHENTICATION_REQUIRED';
    end if;
  else
    select * into proof from kaq_private.account_proofs where id = p_proof_id for share;
    if not found or proof.intent_id is distinct from initial_proof_intent_id
      or proof.auth_uid is distinct from actor_uid or proof.session_id is distinct from actor_session_id
      or proof.consumed_at is null then
      raise exception using errcode = 'PT401', message = 'KAQ_REAUTHENTICATION_REQUIRED';
    end if;
    select * into intent from kaq_private.account_intents where id = proof.intent_id for share;
    select * into receipt from kaq_private.account_merge_receipts where id = p_receipt_id for share;
    if not found or intent.state <> 'committed' or receipt.intent_id is distinct from proof.intent_id
      or receipt.canonical_account_id is distinct from member.account_id then
      raise exception using errcode = 'PT401', message = 'KAQ_REAUTHENTICATION_REQUIRED';
    end if;
    insert into kaq_private.account_committed_proof_bindings(
      proof_id, receipt_id, intent_id, auth_user_id, session_id, canonical_account_id,
      membership_epoch, account_fence_at, membership_fence_at
    ) values (
      proof.id, receipt.id, proof.intent_id, actor_uid, actor_session_id, member.account_id,
      member.epoch, account.session_fence_at, member.session_fence_at
    ) on conflict (proof_id) do nothing;
    select * into binding from kaq_private.account_committed_proof_bindings where proof_id = proof.id for share;
    if not found or binding.receipt_id is distinct from receipt.id
      or binding.intent_id is distinct from proof.intent_id
      or binding.auth_user_id is distinct from actor_uid
      or binding.session_id is distinct from actor_session_id
      or binding.canonical_account_id is distinct from member.account_id
      or binding.membership_epoch is distinct from member.epoch then
      raise exception using errcode = 'PT401', message = 'KAQ_REAUTHENTICATION_REQUIRED';
    end if;
    if not (
      account.session_fence_at is not distinct from binding.account_fence_at
      and member.session_fence_at is not distinct from binding.membership_fence_at
    ) then
      raise exception using errcode = 'PT401', message = 'KAQ_REAUTHENTICATION_REQUIRED';
    end if;
  end if;

  select * into grant_row from kaq_private.learning_session_grants where session_id = actor_session_id for update;
  if found then
    if grant_row.auth_user_id is distinct from actor_uid or grant_row.account_id is distinct from member.account_id
      or grant_row.membership_epoch is distinct from member.epoch or grant_row.reason is distinct from p_reason
      or grant_row.proof_id is distinct from p_proof_id or grant_row.revoked_at is not null then
      raise exception using errcode = 'PT409', message = 'KAQ_GRANT_CONFLICT';
    end if;
  else
    insert into kaq_private.learning_session_grants(
      session_id, auth_user_id, account_id, membership_epoch, reason, proof_id
    ) values (actor_session_id, actor_uid, member.account_id, member.epoch, p_reason, p_proof_id)
    on conflict (session_id) do nothing;
    select * into grant_row from kaq_private.learning_session_grants where session_id = actor_session_id for update;
    if not found or grant_row.auth_user_id is distinct from actor_uid or grant_row.account_id is distinct from member.account_id
      or grant_row.membership_epoch is distinct from member.epoch or grant_row.reason is distinct from p_reason
      or grant_row.proof_id is distinct from p_proof_id or grant_row.revoked_at is not null then
      raise exception using errcode = 'PT409', message = 'KAQ_GRANT_CONFLICT';
    end if;
  end if;
  -- grant row の待機後も、JWT/live session/fence/binding を同じ transaction で再検査する。
  final_context := kaq_private.lock_request_context();
  if final_context is distinct from initial_context then
    raise exception using errcode = '28000', message = 'KAQ_AUTH_CONTEXT_INVALID';
  end if;
  live_session := kaq_private.assert_live_session(actor_uid, actor_session_id, false);
  if p_reason = 'reauthenticated' then
    select updated_at into oauth_at from auth.mfa_amr_claims
      where session_id = actor_session_id and authentication_method = 'oauth' for share;
    if oauth_at is null or not isfinite(oauth_at) or oauth_at > clock_timestamp() + interval '5 seconds'
      or (fence_at is not null and (live_session.created_at <= fence_at or oauth_at <= fence_at)) then
      raise exception using errcode = 'PT401', message = 'KAQ_REAUTHENTICATION_REQUIRED';
    end if;
  else
    select * into binding from kaq_private.account_committed_proof_bindings where proof_id = p_proof_id for share;
    if not found or binding.auth_user_id is distinct from actor_uid or binding.session_id is distinct from actor_session_id
      or binding.canonical_account_id is distinct from member.account_id or binding.membership_epoch is distinct from member.epoch
      or not (account.session_fence_at is not distinct from binding.account_fence_at)
      or not (member.session_fence_at is not distinct from binding.membership_fence_at) then
      raise exception using errcode = 'PT401', message = 'KAQ_REAUTHENTICATION_REQUIRED';
    end if;
  end if;
  return jsonb_build_object('account_id', member.account_id, 'membership_epoch', member.epoch, 'reason', p_reason);
end $$;
revoke all on function kaq_private.issue_learning_session_grant(text, uuid, uuid)
  from public, anon, authenticated, service_role;

create function kaq_private.resolve_current_learning_grant() returns jsonb
language plpgsql stable security definer
set search_path = pg_catalog, auth, kaq_private
as $$
declare
  actor auth.sessions%rowtype;
  member kaq_private.learning_memberships%rowtype;
  account kaq_private.learning_accounts%rowtype;
  grant_row kaq_private.learning_session_grants%rowtype;
  proof kaq_private.account_proofs%rowtype;
  receipt kaq_private.account_merge_receipts%rowtype;
  intent kaq_private.account_intents%rowtype;
  binding kaq_private.account_committed_proof_bindings%rowtype;
  oauth_at timestamptz; fence_at timestamptz;
begin
  actor := kaq_private.read_actor_session();
  select * into member from kaq_private.learning_memberships where auth_user_id = actor.user_id;
  select * into account from kaq_private.learning_accounts where id = member.account_id;
  select * into grant_row from kaq_private.learning_session_grants where session_id = actor.id;
  if member.auth_user_id is null or member.status <> 'active' or account.id is null or account.status <> 'active'
    or grant_row.session_id is null or grant_row.auth_user_id is distinct from actor.user_id
    or grant_row.account_id is distinct from member.account_id or grant_row.membership_epoch is distinct from member.epoch
    or grant_row.revoked_at is not null then
    raise exception using errcode = 'PT401', message = 'KAQ_REAUTHENTICATION_REQUIRED';
  end if;
  if (account.session_fence_at is not null and not isfinite(account.session_fence_at))
    or (member.session_fence_at is not null and not isfinite(member.session_fence_at)) then
    raise exception using errcode = 'PT401', message = 'KAQ_REAUTHENTICATION_REQUIRED';
  end if;
  if grant_row.reason = 'proof' then
    select * into binding from kaq_private.account_committed_proof_bindings where proof_id = grant_row.proof_id;
    select * into proof from kaq_private.account_proofs where id = grant_row.proof_id;
    select * into intent from kaq_private.account_intents where id = proof.intent_id;
    select * into receipt from kaq_private.account_merge_receipts where id = binding.receipt_id;
    if binding.proof_id is null or proof.id is null or proof.consumed_at is null or intent.id is null
      or intent.state <> 'committed' or receipt.id is null or receipt.intent_id is distinct from proof.intent_id
      or binding.auth_user_id is distinct from actor.user_id or binding.session_id is distinct from actor.id
      or binding.canonical_account_id is distinct from member.account_id or binding.membership_epoch is distinct from member.epoch
      or receipt.canonical_account_id is distinct from member.account_id then
      raise exception using errcode = 'PT401', message = 'KAQ_REAUTHENTICATION_REQUIRED';
    end if;
    if not (
      account.session_fence_at is not distinct from binding.account_fence_at
      and member.session_fence_at is not distinct from binding.membership_fence_at
    ) then
      raise exception using errcode = 'PT401', message = 'KAQ_REAUTHENTICATION_REQUIRED';
    end if;
  else
    if grant_row.proof_id is not null then raise exception using errcode = 'PT401', message = 'KAQ_REAUTHENTICATION_REQUIRED'; end if;
    select updated_at into oauth_at from auth.mfa_amr_claims
      where session_id = actor.id and authentication_method = 'oauth';
    fence_at := greatest(account.session_fence_at, member.session_fence_at);
    if oauth_at is null or not isfinite(oauth_at) or oauth_at > clock_timestamp() + interval '5 seconds' or (fence_at is not null and (
      actor.created_at <= fence_at or oauth_at <= fence_at
    )) then raise exception using errcode = 'PT401', message = 'KAQ_REAUTHENTICATION_REQUIRED'; end if;
  end if;
  return jsonb_build_object('account_id', member.account_id, 'membership_epoch', member.epoch, 'reason', grant_row.reason);
end $$;
revoke all on function kaq_private.resolve_current_learning_grant()
  from public, anon, authenticated, service_role;

commit;
