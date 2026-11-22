-- #58 全体退会の private durable ledger。authority 作成/内容消去/公開wakeは別部品。
create table kaq_private.account_delete_jobs (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null unique default gen_random_uuid(),
  authority_state text not null check (authority_state = 'approved'),
  authority_approved_at timestamptz not null,
  scope_account_id uuid not null,
  scope_fence_at timestamptz not null,
  scope_commitment bytea not null check (octet_length(scope_commitment) = 32),
  content_erased_at timestamptz not null,
  content_commitment bytea not null check (octet_length(content_commitment) = 32),
  capability_hash bytea not null check (octet_length(capability_hash) = 32),
  capability_expires_at timestamptz not null,
  state text not null default 'prepared' check (state in ('prepared', 'leased', 'retryable_failure')),
  next_attempt_at timestamptz not null default clock_timestamp(),
  lease_id uuid,
  lease_expires_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  retry_count integer not null default 0 check (retry_count >= 0),
  last_failure text check (last_failure in ('auth_still_present', 'auth_unavailable', 'batch_limit', 'scope_invalid')),
  target_count integer not null check (target_count > 0),
  created_at timestamptz not null default clock_timestamp(),
  check ((lease_id is null) = (lease_expires_at is null)),
  check (capability_expires_at > authority_approved_at),
  check (content_erased_at >= authority_approved_at)
);
create unique index account_delete_jobs_one_scope_idx on kaq_private.account_delete_jobs(scope_account_id);
alter table kaq_private.account_delete_jobs enable row level security;

create table kaq_private.account_delete_job_targets (
  job_id uuid not null references kaq_private.account_delete_jobs(id) on delete cascade,
  ordinal integer not null check (ordinal >= 0),
  auth_uid uuid not null,
  is_anchor boolean not null default false,
  absent_at timestamptz,
  primary key (job_id, auth_uid),
  unique (job_id, ordinal)
);
alter table kaq_private.account_delete_job_targets enable row level security;

create table kaq_private.account_delete_receipts (
  id uuid primary key,
  state text not null check (state = 'completed'),
  completed_at timestamptz not null,
  target_count integer not null check (target_count > 0)
);
alter table kaq_private.account_delete_receipts enable row level security;

create function kaq_private.account_delete_scope_current(p_job_id uuid) returns boolean
language plpgsql stable security definer set search_path = pg_catalog, kaq_private
as $$
declare job kaq_private.account_delete_jobs%rowtype;
begin
  select * into job from kaq_private.account_delete_jobs where id = p_job_id;
  if not found or job.authority_state <> 'approved' or job.content_erased_at is null
    or job.scope_commitment is null or job.content_commitment is null then return false; end if;
  -- 確認済みUIDの再作成を無視して残りのAuthを削除しない。
  if exists(select 1 from kaq_private.account_delete_job_targets target
    join auth.users auth_user on auth_user.id=target.auth_uid
    where target.job_id=job.id and target.absent_at is not null) then return false; end if;
  if not exists(select 1 from kaq_private.learning_accounts account where account.id = job.scope_account_id
    and account.status = 'deleting' and account.session_fence_at is not distinct from job.scope_fence_at) then return false; end if;
  if (select count(*) from kaq_private.account_delete_job_targets where job_id = job.id) <> job.target_count
    or (select count(*) from kaq_private.account_delete_job_targets where job_id = job.id and is_anchor) <> 1 then return false; end if;
  if exists(select 1 from kaq_private.learning_memberships member where member.account_id = job.scope_account_id
    and not exists(select 1 from kaq_private.account_delete_job_targets target where target.job_id = job.id and target.auth_uid = member.auth_user_id)) then return false; end if;
  if exists(select 1 from kaq_private.account_delete_job_targets target join kaq_private.learning_memberships member
    on member.auth_user_id = target.auth_uid where target.job_id = job.id and member.account_id <> job.scope_account_id) then return false; end if;
  if exists(select 1 from kaq_private.account_delete_job_targets target left join kaq_private.learning_memberships member
    on member.auth_user_id = target.auth_uid where target.job_id = job.id and target.absent_at is null
      and ((member.auth_user_id is null and exists(select 1 from auth.users auth_user where auth_user.id = target.auth_uid))
        or (member.auth_user_id is not null and (member.account_id <> job.scope_account_id or member.status <> 'disabled'
          or member.session_fence_at is distinct from job.scope_fence_at)))) then return false; end if;
  return true;
end $$;

create function kaq_private.claim_account_delete_job() returns table(job_id uuid, lease_id uuid)
language plpgsql volatile security definer set search_path = pg_catalog, kaq_private
as $$
declare job kaq_private.account_delete_jobs%rowtype; next_lease uuid := gen_random_uuid();
begin
  select * into job from kaq_private.account_delete_jobs where next_attempt_at <= clock_timestamp()
    and (state in ('prepared', 'retryable_failure') or (state = 'leased' and lease_expires_at <= clock_timestamp()))
    order by next_attempt_at, id for update skip locked limit 1;
  if not found then return; end if;
  if not kaq_private.account_delete_scope_current(job.id) then
    update kaq_private.account_delete_jobs set state = 'retryable_failure', lease_id = null, lease_expires_at = null,
      retry_count = retry_count + 1, last_failure = 'scope_invalid',
      next_attempt_at = clock_timestamp() + make_interval(secs => least(3600, power(2, least(retry_count + 1, 12))::integer))
      where id = job.id;
    return;
  end if;
  update kaq_private.account_delete_jobs set state = 'leased', lease_id = next_lease,
    lease_expires_at = clock_timestamp() + interval '2 minutes', attempt_count = attempt_count + 1, last_failure = null
    where id = job.id;
  return query select job.id, next_lease;
end $$;

create function kaq_private.next_account_delete_target(p_lease_id uuid)
returns table(auth_uid uuid, is_anchor boolean, remaining_non_anchor integer)
language plpgsql volatile security definer set search_path = pg_catalog, kaq_private
as $$
declare job kaq_private.account_delete_jobs%rowtype;
begin
  select * into job from kaq_private.account_delete_jobs where lease_id = p_lease_id and state = 'leased'
    and lease_expires_at > clock_timestamp() for update;
  if not found then return; end if;
  if not kaq_private.account_delete_scope_current(job.id) then
    update kaq_private.account_delete_jobs set state = 'retryable_failure', lease_id = null, lease_expires_at = null,
      retry_count = retry_count + 1, last_failure = 'scope_invalid',
      next_attempt_at = clock_timestamp() + make_interval(secs => least(3600, power(2, least(retry_count + 1, 12))::integer))
      where id = job.id;
    return;
  end if;
  return query select target.auth_uid, target.is_anchor,
    (select count(*)::integer from kaq_private.account_delete_job_targets other
      where other.job_id = job.id and not other.is_anchor and other.absent_at is null)
    from kaq_private.account_delete_job_targets target where target.job_id = job.id and target.absent_at is null
      and (not target.is_anchor or not exists(select 1 from kaq_private.account_delete_job_targets other
        where other.job_id = job.id and not other.is_anchor and other.absent_at is null))
    order by target.is_anchor, target.ordinal limit 1;
end $$;

create function kaq_private.confirm_account_delete_target_absent(p_lease_id uuid, p_auth_uid uuid) returns boolean
language plpgsql volatile security definer set search_path = pg_catalog, kaq_private
as $$
declare job kaq_private.account_delete_jobs%rowtype; target kaq_private.account_delete_job_targets%rowtype;
begin
  select * into job from kaq_private.account_delete_jobs where lease_id = p_lease_id and state = 'leased'
    and lease_expires_at > clock_timestamp() for update;
  select * into target from kaq_private.account_delete_job_targets where job_id = job.id and auth_uid = p_auth_uid
    and absent_at is null for update;
  if not found or exists(select 1 from auth.users auth_user where auth_user.id = target.auth_uid)
    or not kaq_private.account_delete_scope_current(job.id)
    or (target.is_anchor and exists(select 1 from kaq_private.account_delete_job_targets other
    where other.job_id = job.id and not other.is_anchor and other.absent_at is null)) then return false; end if;
  update kaq_private.account_delete_job_targets set absent_at = clock_timestamp()
    where job_id = job.id and auth_uid = target.auth_uid and absent_at is null;
  return found;
end $$;

create function kaq_private.defer_account_delete_job(p_lease_id uuid, p_reason text) returns void
language plpgsql volatile security definer set search_path = pg_catalog, kaq_private
as $$
begin
  if p_reason is null or p_reason not in ('auth_still_present', 'auth_unavailable', 'batch_limit') then
    raise exception using errcode = 'PT400', message = 'KAQ_DELETE_JOB_REASON_INVALID';
  end if;
  update kaq_private.account_delete_jobs set state = 'retryable_failure', lease_id = null, lease_expires_at = null,
    retry_count = retry_count + 1, last_failure = p_reason,
    next_attempt_at = clock_timestamp() + make_interval(secs => least(3600, power(2, least(retry_count + 1, 12))::integer))
    where lease_id = p_lease_id and state = 'leased' and lease_expires_at > clock_timestamp();
  if not found then raise exception using errcode = 'PT409', message = 'KAQ_DELETE_JOB_LEASE_LOST'; end if;
end $$;

create function kaq_private.complete_account_delete_job(p_lease_id uuid) returns boolean
language plpgsql volatile security definer set search_path = pg_catalog, kaq_private
as $$
declare job kaq_private.account_delete_jobs%rowtype;
begin
  select * into job from kaq_private.account_delete_jobs where lease_id = p_lease_id and state = 'leased'
    and lease_expires_at > clock_timestamp() for update;
  if not found or exists(select 1 from kaq_private.account_delete_job_targets target
    join auth.users auth_user on auth_user.id = target.auth_uid where target.job_id = job.id)
    or not kaq_private.account_delete_scope_current(job.id)
    or exists(select 1 from kaq_private.account_delete_job_targets where job_id = job.id and absent_at is null) then return false; end if;
  insert into kaq_private.account_delete_receipts(id, state, completed_at, target_count)
    values(job.receipt_id, 'completed', clock_timestamp(), job.target_count);
  delete from kaq_private.account_delete_jobs where id = job.id and lease_id = p_lease_id;
  return found;
end $$;

create function kaq_private.read_account_delete_receipt(p_receipt_id uuid) returns text
language sql stable security definer set search_path = pg_catalog, kaq_private
as $$ select case when exists(select 1 from kaq_private.account_delete_receipts where id = p_receipt_id)
  then 'completed' else 'unknown' end $$;

revoke all on table kaq_private.account_delete_jobs, kaq_private.account_delete_job_targets,
  kaq_private.account_delete_receipts from public, anon, authenticated, service_role;
revoke all on function kaq_private.account_delete_scope_current(uuid), kaq_private.claim_account_delete_job(),
  kaq_private.next_account_delete_target(uuid), kaq_private.confirm_account_delete_target_absent(uuid,uuid),
  kaq_private.defer_account_delete_job(uuid,text), kaq_private.complete_account_delete_job(uuid),
  kaq_private.read_account_delete_receipt(uuid) from public, anon, authenticated, service_role;
