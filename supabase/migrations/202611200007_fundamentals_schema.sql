-- #25のtrusted catalogと受験回正本。001--006適用後だけを対象にする。
-- 公開済みcatalogは改竄せず、教材改訂は別content_versionの追加として残す。
create table public.published_fundamentals_catalogs (
  unit_id text not null check (length(unit_id) between 1 and 120),
  content_version text not null check (length(content_version) between 1 and 80),
  content_hash bytea not null check (octet_length(content_hash) = 32),
  plan jsonb not null check (jsonb_typeof(plan) = 'array'),
  final_questions jsonb not null check (jsonb_typeof(final_questions) = 'array'),
  published_at timestamptz not null default clock_timestamp(),
  primary key (unit_id, content_version),
  unique (unit_id, content_hash)
);

create function public.reject_published_fundamentals_catalog_mutation() returns trigger
language plpgsql set search_path = public, auth as $$
begin
  raise exception 'published fundamentals catalogs are append-only' using errcode = '55000';
end $$;

create trigger published_fundamentals_catalogs_append_only
  before update or delete on public.published_fundamentals_catalogs
  for each row execute function public.reject_published_fundamentals_catalog_mutation();

create table public.fundamentals_unit_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  unit_id text not null check (length(unit_id) between 1 and 120),
  content_version text not null check (length(content_version) between 1 and 80),
  completed_slide_ids jsonb not null default '[]'::jsonb check (jsonb_typeof(completed_slide_ids) = 'array'),
  completed_checkpoint_ids jsonb not null default '[]'::jsonb check (jsonb_typeof(completed_checkpoint_ids) = 'array'),
  furthest_plan_position integer not null default 0 check (furthest_plan_position >= 0),
  resume_stage text not null default 'slide' check (resume_stage in ('slide', 'checkpoint', 'final', 'result')),
  resume_step_id text,
  active_final_session_id uuid,
  passed_final_session_id uuid,
  passed_at timestamptz,
  revision bigint not null default 0 check (revision >= 0),
  last_mutation_id uuid,
  last_mutation_hash bytea check (last_mutation_hash is null or octet_length(last_mutation_hash) = 32),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, unit_id, content_version),
  foreign key (unit_id, content_version) references public.published_fundamentals_catalogs(unit_id, content_version),
  check ((passed_final_session_id is null) = (passed_at is null))
);

create table public.fundamentals_final_sessions (
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  unit_id text not null check (length(unit_id) between 1 and 120),
  content_version text not null check (length(content_version) between 1 and 80),
  catalog_hash bytea not null check (octet_length(catalog_hash) = 32),
  start_hash bytea not null check (octet_length(start_hash) = 32),
  question_order jsonb not null check (jsonb_typeof(question_order) = 'array'),
  responses jsonb not null default '{}'::jsonb check (jsonb_typeof(responses) = 'object'),
  position integer not null default 0 check (position >= 0),
  state text not null default 'draft' check (state in ('draft', 'submitted')),
  score integer,
  required_score integer not null check (required_score > 0),
  passed boolean,
  started_at timestamptz not null default clock_timestamp(),
  submitted_at timestamptz,
  submitted_received_at timestamptz,
  submission_hash bytea check (submission_hash is null or octet_length(submission_hash) = 32),
  revision bigint not null default 0 check (revision >= 0),
  last_response_receipt_id uuid,
  last_response_receipt_hash bytea check (last_response_receipt_hash is null or octet_length(last_response_receipt_hash) = 32),
  primary key (user_id, session_id),
  unique (user_id, session_id, unit_id, content_version),
  foreign key (unit_id, content_version) references public.published_fundamentals_catalogs(unit_id, content_version),
  check ((state = 'draft' and score is null and passed is null and submitted_at is null and submitted_received_at is null and submission_hash is null)
      or (state = 'submitted' and score is not null and passed is not null and submitted_at is not null and submitted_received_at is not null and submission_hash is not null))
);

create unique index fundamentals_one_active_final_per_unit_version_idx
  on public.fundamentals_final_sessions (user_id, unit_id, content_version) where state = 'draft';

alter table public.fundamentals_unit_progress add constraint fundamentals_progress_active_session_fk
  foreign key (user_id, active_final_session_id, unit_id, content_version)
  references public.fundamentals_final_sessions(user_id, session_id, unit_id, content_version) deferrable initially deferred;
alter table public.fundamentals_unit_progress add constraint fundamentals_progress_passed_session_fk
  foreign key (user_id, passed_final_session_id, unit_id, content_version)
  references public.fundamentals_final_sessions(user_id, session_id, unit_id, content_version) deferrable initially deferred;

-- modeの既存三値を変えず、lesson由来はnullable provenanceで表す。
alter table public.learning_events add column fundamentals_session_id uuid;
alter table public.learning_events add column learning_context jsonb check (learning_context is null or jsonb_typeof(learning_context) = 'object');
alter table public.learning_events add column selection_polarity text check (selection_polarity is null or selection_polarity in ('correct', 'incorrect'));
alter table public.learning_events add column required_choices smallint check (required_choices is null or required_choices > 0);
alter table public.learning_events add constraint learning_events_fundamentals_context_check check (
  (fundamentals_session_id is null and (learning_context is null or learning_context->>'kind' = 'lesson-checkpoint'))
  or (fundamentals_session_id is not null and learning_context->>'kind' = 'lesson-final'
      and learning_context->>'sessionId' = fundamentals_session_id::text)
);
alter table public.learning_events add constraint learning_events_final_session_fk
  foreign key (user_id, fundamentals_session_id)
  references public.fundamentals_final_sessions(user_id, session_id) on delete cascade;
create unique index learning_events_one_fundamentals_final_answer_idx
  on public.learning_events(user_id, fundamentals_session_id, question_id, question_revision)
  where fundamentals_session_id is not null;

alter table public.published_fundamentals_catalogs enable row level security;
alter table public.fundamentals_unit_progress enable row level security;
alter table public.fundamentals_final_sessions enable row level security;
revoke all on table public.published_fundamentals_catalogs, public.fundamentals_unit_progress,
  public.fundamentals_final_sessions from public, anon, authenticated;
revoke all on function public.reject_published_fundamentals_catalog_mutation() from public, anon, authenticated;

-- ゲストlessonの明示移行も既存manifestの受理対象にする。旧種別の制約は維持する。
alter table public.migration_manifests drop constraint migration_manifests_source_name_check;
alter table public.migration_manifests add constraint migration_manifests_source_name_check check (source_name in (
  'history-local-storage', 'wrong-cookie-v1', 'wrong-index-local-storage', 'exam-draft-local-storage',
  'profile-local-storage', 'fundamentals-progress-local-storage'
));
alter table public.migration_items drop constraint migration_items_import_kind_check;
alter table public.migration_items add constraint migration_items_import_kind_check check (import_kind in (
  'exam-session', 'roadmap-profile', 'fundamentals-unit'
));
alter table public.migration_items drop constraint migration_items_check;
alter table public.migration_items add constraint migration_items_check check (
  (import_kind is null and exam_id is null and payload_hash is null)
  or (import_kind = 'exam-session' and exam_id is not null and payload_hash is not null)
  or (import_kind in ('roadmap-profile', 'fundamentals-unit') and exam_id is null and payload_hash is not null)
);
