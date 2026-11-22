-- 未登録のprivate補助schema提案。production migration/registryへは接続しない。
-- 現public schemaで一意にできない未選択final/manifest variantを原本のまま保つ。
create table kaq_private.account_merge_resolution_choices (
  receipt_id uuid not null references kaq_private.account_merge_receipts(id) on delete cascade,
  choice_kind text not null check (choice_kind in ('assessment', 'dashboard', 'roadmap', 'exam_resume', 'final_resume', 'manifest_head')),
  choice_scope jsonb not null check (jsonb_typeof(choice_scope) = 'object'),
  selected_origin_account_id uuid not null,
  selected_row_key jsonb not null check (jsonb_typeof(selected_row_key) = 'object'),
  created_at timestamptz not null default clock_timestamp(),
  primary key (receipt_id, choice_kind, choice_scope)
);

create table kaq_private.account_merge_deferred_rows (
  receipt_id uuid not null references kaq_private.account_merge_receipts(id) on delete cascade,
  canonical_account_id uuid not null references kaq_private.learning_accounts(id),
  origin_account_id uuid not null,
  table_name text not null check (table_name in ('fundamentals_final_sessions', 'migration_manifests', 'migration_items')),
  row_key jsonb not null check (jsonb_typeof(row_key) = 'object'),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  payload_hash bytea not null check (octet_length(payload_hash) = 32),
  reason text not null check (reason in ('unselected_draft', 'unselected_manifest_variant')),
  primary key (receipt_id, origin_account_id, table_name, row_key)
);

-- 名前や定義が変わった既存indexを誤って置換しないよう、適用前に完全一致を要求する。
do $$
begin
  if pg_get_indexdef('public.fundamentals_one_active_final_per_unit_version_idx'::regclass)
    <> 'CREATE UNIQUE INDEX fundamentals_one_active_final_per_unit_version_idx ON public.fundamentals_final_sessions USING btree (user_id, unit_id, content_version) WHERE (state = ''draft''::text)' then
    raise exception using errcode = 'PT500', message = 'KAQ_MERGE_FINAL_UNIQUE_CHANGED';
  end if;
  if not exists(select 1 from pg_constraint where conrelid = 'public.migration_manifests'::regclass
    and conname = 'migration_manifests_user_id_source_name_source_fingerprint_key' and contype = 'u') then
    raise exception using errcode = 'PT500', message = 'KAQ_MERGE_MANIFEST_UNIQUE_CHANGED';
  end if;
  if not exists(select 1 from pg_constraint where conrelid = 'public.exam_sessions'::regclass
    and conname = 'exam_sessions_pkey' and contype = 'p')
    or not exists(select 1 from pg_constraint where conrelid = 'public.exam_sessions'::regclass
      and conname = 'exam_sessions_user_id_exam_id_key' and contype = 'u') then
    raise exception using errcode = 'PT500', message = 'KAQ_MERGE_EXAM_KEY_CHANGED';
  end if;
end $$;

alter table public.fundamentals_final_sessions add column is_active boolean;
update public.fundamentals_final_sessions set is_active = state = 'draft' where is_active is null;
alter table public.fundamentals_final_sessions alter column is_active set not null;
alter table public.fundamentals_final_sessions add constraint fundamentals_final_active_state_check
  check (not is_active or state = 'draft');
drop index public.fundamentals_one_active_final_per_unit_version_idx;
create unique index fundamentals_one_active_final_per_unit_version_idx
  on public.fundamentals_final_sessions(user_id, unit_id, content_version) where state = 'draft' and is_active;

alter table public.migration_manifests drop constraint migration_manifests_user_id_source_name_source_fingerprint_key;

-- import RPCの既存競合targetを維持しつつ、同じ受験IDを別ownerごとに保存できる主キーへ変える。
-- 既存の(user_id, exam_id) uniqueは子のFKが参照するため残す。
alter table public.exam_sessions drop constraint exam_sessions_pkey;
alter table public.exam_sessions add constraint exam_sessions_pkey primary key (user_id, exam_id);

create table kaq_private.account_merge_resume_heads (
  receipt_id uuid not null references kaq_private.account_merge_receipts(id) on delete cascade,
  canonical_account_id uuid not null references kaq_private.learning_accounts(id),
  unit_id text not null, content_version text not null,
  session_id uuid not null,
  origin_account_id uuid not null,
  foreign key (canonical_account_id, session_id, unit_id, content_version)
    references public.fundamentals_final_sessions(user_id, session_id, unit_id, content_version),
  primary key (receipt_id, unit_id, content_version), unique(canonical_account_id, unit_id, content_version)
);
create table kaq_private.account_merge_replay_heads (
  receipt_id uuid not null references kaq_private.account_merge_receipts(id) on delete cascade,
  canonical_account_id uuid not null references kaq_private.learning_accounts(id),
  source_name text not null, source_fingerprint text not null,
  manifest_id uuid not null,
  origin_account_id uuid not null,
  foreign key (canonical_account_id, manifest_id)
    references public.migration_manifests(user_id, manifest_id),
  primary key (receipt_id, source_name, source_fingerprint), unique(canonical_account_id, source_name, source_fingerprint)
);

-- Receipt/archive/id-map は immutable のまま、次の merge と退会照合だけがこの closure を辿る。
create table kaq_private.account_merge_lineage_closure (
  ancestor_account_id uuid primary key references kaq_private.learning_accounts(id),
  current_canonical_account_id uuid not null references kaq_private.learning_accounts(id),
  established_receipt_id uuid not null references kaq_private.account_merge_receipts(id),
  updated_at timestamptz not null default clock_timestamp(),
  check (ancestor_account_id <> current_canonical_account_id)
);

-- 統合後は同じ出典の異なる原本も保持するため、削除したuniqueを競合targetに使わない。
-- 単一原本または明示headだけを再送先にし、日時順で競合原本を黙って選ばない。
create or replace function public.begin_migration(
  p_expected_generation bigint, p_manifest_id uuid, p_source_name text,
  p_schema_version integer, p_fingerprint text, p_declared_rows integer
) returns uuid language plpgsql security definer set search_path = public, auth, kaq_private as $$
declare
  v_user_id uuid := public.require_learning_generation(p_expected_generation);
  v_manifest public.migration_manifests%rowtype;
  v_variants integer;
begin
  if p_manifest_id is null or p_source_name is null or p_schema_version is null
    or p_fingerprint is null or p_declared_rows is null then
    raise exception 'invalid migration manifest' using errcode = '22023';
  end if;
  select count(*) into v_variants from public.migration_manifests
    where user_id = v_user_id and source_name = p_source_name and source_fingerprint = p_fingerprint;
  if v_variants = 0 then
    insert into public.migration_manifests(
      user_id, manifest_id, source_name, source_schema_version, source_fingerprint, declared_rows
    ) values (v_user_id, p_manifest_id, p_source_name, p_schema_version, p_fingerprint, p_declared_rows)
    returning * into v_manifest;
  elsif v_variants = 1 then
    select * into strict v_manifest from public.migration_manifests
      where user_id = v_user_id and source_name = p_source_name and source_fingerprint = p_fingerprint
      for update;
  else
    select manifest.* into v_manifest from kaq_private.account_merge_replay_heads head
      join public.migration_manifests manifest on manifest.user_id = v_user_id and manifest.manifest_id = head.manifest_id
      where head.canonical_account_id = v_user_id and head.source_name = p_source_name
        and head.source_fingerprint = p_fingerprint
      for update of manifest;
    if not found then
      raise exception using errcode = 'PT409', message = 'KAQ_MERGE_MANIFEST_HEAD_REQUIRED';
    end if;
  end if;
  if v_manifest.source_schema_version <> p_schema_version or v_manifest.declared_rows <> p_declared_rows then
    raise exception 'migration manifest reused with different shape' using errcode = '23505';
  end if;
  return v_manifest.manifest_id;
end $$;
revoke all on function public.begin_migration(bigint,uuid,text,integer,text,integer)
  from public, anon;
grant execute on function public.begin_migration(bigint,uuid,text,integer,text,integer) to authenticated, service_role;

alter table kaq_private.account_merge_resolution_choices enable row level security;
alter table kaq_private.account_merge_deferred_rows enable row level security;
alter table kaq_private.account_merge_resume_heads enable row level security;
alter table kaq_private.account_merge_replay_heads enable row level security;
alter table kaq_private.account_merge_lineage_closure enable row level security;
revoke all on table kaq_private.account_merge_resolution_choices, kaq_private.account_merge_deferred_rows,
  kaq_private.account_merge_resume_heads, kaq_private.account_merge_replay_heads
  , kaq_private.account_merge_lineage_closure
  from public, anon, authenticated, service_role;
