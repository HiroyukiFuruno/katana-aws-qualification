-- #58の非公開基盤だけを追加する。既存owner/FK/RLS/RPCのcutoverは別migrationで行う。
create schema kaq_private;
revoke all on schema kaq_private from public, anon, authenticated, service_role;
alter default privileges in schema kaq_private revoke all on tables from public, anon, authenticated, service_role;
alter default privileges in schema kaq_private revoke all on functions from public, anon, authenticated, service_role;
alter default privileges in schema kaq_private revoke all on sequences from public, anon, authenticated, service_role;

create table kaq_private.learning_accounts (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'active' check (status in ('active', 'retired', 'deleting')),
  membership_revision bigint not null default 0 check (membership_revision >= 0),
  session_fence_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  retired_at timestamptz,
  check ((status = 'retired') = (retired_at is not null))
);

-- Auth削除はmembershipだけに作用し、学習accountをcascadeで消さない。
create table kaq_private.learning_memberships (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  account_id uuid not null references kaq_private.learning_accounts(id),
  epoch bigint not null default 0 check (epoch >= 0),
  status text not null default 'active' check (status in ('active', 'detached', 'disabled')),
  session_fence_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
create index learning_memberships_account_idx on kaq_private.learning_memberships(account_id, auth_user_id);

-- epoch変更は既存grantへcascadeしない。毎要求で現在membershipと照合する。
create table kaq_private.learning_session_grants (
  session_id uuid primary key references auth.sessions(id) on delete cascade,
  auth_user_id uuid not null references kaq_private.learning_memberships(auth_user_id) on delete cascade,
  account_id uuid not null references kaq_private.learning_accounts(id),
  membership_epoch bigint not null check (membership_epoch >= 0),
  reason text not null check (reason in ('legacy', 'created', 'proof', 'reauthenticated')),
  created_at timestamptz not null default clock_timestamp(),
  revoked_at timestamptz
);
create index learning_session_grants_account_idx on kaq_private.learning_session_grants(account_id, auth_user_id);

create table kaq_private.account_intents (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('add_existing', 'merge_existing')),
  actor_uid uuid not null,
  actor_session_id uuid not null,
  secret_hash bytea not null check (octet_length(secret_hash) = 32),
  state text not null default 'awaiting_source' check (state in (
    'awaiting_source', 'awaiting_target', 'both_proved', 'previewed', 'committed',
    'already_linked', 'cancelled', 'expired', 'attempts_exhausted'
  )),
  revision bigint not null default 0 check (revision >= 0),
  source_account_id uuid references kaq_private.learning_accounts(id),
  source_membership_epoch bigint check (source_membership_epoch >= 0),
  target_uid uuid,
  target_account_id uuid references kaq_private.learning_accounts(id),
  target_membership_epoch bigint check (target_membership_epoch >= 0),
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  preview_id uuid,
  preview_digest bytea check (preview_digest is null or octet_length(preview_digest) = 32),
  preview_document jsonb check (preview_document is null or jsonb_typeof(preview_document) = 'object'),
  preview_expires_at timestamptz,
  check (expires_at > created_at and expires_at <= created_at + interval '10 minutes'),
  check ((kind = 'merge_existing') = (source_account_id is not null)),
  check ((source_account_id is null) = (source_membership_epoch is null)),
  check ((target_uid is null) = (target_account_id is null)),
  check ((target_account_id is null) = (target_membership_epoch is null)),
  check (target_uid is null or target_uid <> actor_uid),
  check ((preview_id is null) = (preview_digest is null)),
  check ((preview_id is null) = (preview_document is null)),
  check ((preview_id is null) = (preview_expires_at is null)),
  check (preview_expires_at is null or (preview_expires_at > created_at and preview_expires_at <= expires_at)),
  check (state <> 'previewed' or preview_id is not null)
);
create unique index account_intents_one_active_actor_idx on kaq_private.account_intents(actor_uid)
  where state in ('awaiting_source', 'awaiting_target', 'both_proved', 'previewed');
create index account_intents_expiry_idx on kaq_private.account_intents(expires_at)
  where state in ('awaiting_source', 'awaiting_target', 'both_proved', 'previewed');

create table kaq_private.account_proof_legs (
  id uuid primary key default gen_random_uuid(),
  intent_id uuid not null references kaq_private.account_intents(id) on delete cascade,
  side text not null check (side in ('source', 'target')),
  attempt integer not null check (attempt between 1 and 3),
  revision bigint not null default 0 check (revision >= 0),
  state text not null default 'issued' check (state in (
    'issued', 'exchanging', 'exchanged', 'proved', 'superseded', 'failed', 'exchange_unknown'
  )),
  expected_uid uuid,
  storage_key text not null unique check (length(storage_key) between 1 and 240),
  ingest_nonce_hash bytea not null check (octet_length(ingest_nonce_hash) = 32),
  issued_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  unique (intent_id, id),
  unique (intent_id, side, attempt),
  check (expires_at > issued_at and expires_at <= issued_at + interval '3 minutes')
);

-- SDK verifierと短命Auth sessionはEdgeで暗号化する。監査/原本archiveへは入れない。
create table kaq_private.account_proof_runtime (
  leg_id uuid primary key references kaq_private.account_proof_legs(id) on delete cascade,
  revision bigint not null default 0 check (revision >= 0),
  encryption_key_version text not null check (length(encryption_key_version) between 1 and 80),
  nonce bytea not null check (octet_length(nonce) = 12),
  ciphertext bytea not null check (octet_length(ciphertext) >= 16),
  expires_at timestamptz not null,
  updated_at timestamptz not null default clock_timestamp(),
  check (expires_at > updated_at and expires_at <= updated_at + interval '10 minutes')
);

-- session削除後も操作receiptを保つ。live性はFKでなく毎回Auth表で検証する。
create table kaq_private.account_proofs (
  id uuid primary key default gen_random_uuid(),
  intent_id uuid not null references kaq_private.account_intents(id) on delete cascade,
  leg_id uuid not null unique,
  auth_uid uuid not null,
  session_id uuid not null unique,
  session_created_at timestamptz not null,
  oauth_at timestamptz not null,
  account_id uuid references kaq_private.learning_accounts(id),
  membership_epoch bigint check (membership_epoch >= 0),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  foreign key (intent_id, leg_id) references kaq_private.account_proof_legs(intent_id, id) on delete cascade,
  check ((account_id is null) = (membership_epoch is null)),
  check (expires_at > oauth_at),
  check (consumed_at is null or consumed_at <= expires_at)
);

create table kaq_private.account_merge_receipts (
  id uuid primary key default gen_random_uuid(),
  intent_id uuid not null unique references kaq_private.account_intents(id) on delete cascade,
  canonical_account_id uuid not null references kaq_private.learning_accounts(id),
  algorithm_version integer not null check (algorithm_version > 0),
  consent_hash bytea not null check (octet_length(consent_hash) = 32),
  before_scopes jsonb not null check (jsonb_typeof(before_scopes) = 'array'),
  choices jsonb not null check (jsonb_typeof(choices) = 'object'),
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  created_at timestamptz not null default clock_timestamp()
);

create table kaq_private.account_merge_archives (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references kaq_private.account_merge_receipts(id) on delete cascade,
  canonical_account_id uuid not null references kaq_private.learning_accounts(id),
  origin_account_id uuid not null,
  table_name text not null check (table_name in (
    'learning_state', 'learning_events', 'exam_sessions', 'exam_responses',
    'earned_certifications', 'assessment_answers', 'migration_manifests', 'migration_items',
    'roadmap_profiles', 'fundamentals_unit_progress', 'fundamentals_final_sessions',
    'dashboard_settings', 'exam_resume_choices'
  )),
  row_key jsonb not null check (jsonb_typeof(row_key) = 'object'),
  row_key_hash bytea not null check (octet_length(row_key_hash) = 32),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  payload_hash bytea not null check (octet_length(payload_hash) = 32),
  unique (receipt_id, origin_account_id, table_name, row_key_hash)
);
create index account_merge_archives_account_idx on kaq_private.account_merge_archives(canonical_account_id);

create table kaq_private.account_merge_id_maps (
  receipt_id uuid not null references kaq_private.account_merge_receipts(id) on delete cascade,
  canonical_account_id uuid not null references kaq_private.learning_accounts(id),
  origin_account_id uuid not null,
  entity_kind text not null check (entity_kind in ('event', 'exam', 'final', 'manifest')),
  original_id uuid not null,
  canonical_id uuid not null,
  original_row_hash bytea not null check (octet_length(original_row_hash) = 32),
  canonical_row_hash bytea not null check (octet_length(canonical_row_hash) = 32),
  original_payload_hash bytea check (original_payload_hash is null or octet_length(original_payload_hash) = 32),
  primary key (receipt_id, origin_account_id, entity_kind, original_id)
);
create index account_merge_id_maps_account_idx on kaq_private.account_merge_id_maps(canonical_account_id);

alter table kaq_private.learning_accounts enable row level security;
alter table kaq_private.learning_memberships enable row level security;
alter table kaq_private.learning_session_grants enable row level security;
alter table kaq_private.account_intents enable row level security;
alter table kaq_private.account_proof_legs enable row level security;
alter table kaq_private.account_proof_runtime enable row level security;
alter table kaq_private.account_proofs enable row level security;
alter table kaq_private.account_merge_receipts enable row level security;
alter table kaq_private.account_merge_archives enable row level security;
alter table kaq_private.account_merge_id_maps enable row level security;
revoke all on all tables in schema kaq_private from public, anon, authenticated, service_role;
revoke all on all sequences in schema kaq_private from public, anon, authenticated, service_role;
revoke all on all functions in schema kaq_private from public, anon, authenticated, service_role;
