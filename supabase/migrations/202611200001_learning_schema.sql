-- 学習記録はauth.uid()の所有者だけが参照し、書込みは検証済みRPCに限定する。
create extension if not exists pgcrypto with schema extensions;

-- reset後の遅延書込みを旧世代として拒否する。世代行は退会時だけFK cascadeで消える。
create table public.learning_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  generation bigint not null default 0 check (generation >= 0)
);

create table public.learning_events (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null,
  payload_hash bytea not null,
  schema_version integer not null check (schema_version > 0),
  certification_id text not null check (length(certification_id) between 1 and 80),
  question_id text not null check (length(question_id) between 1 and 160),
  question_revision integer not null check (question_revision > 0),
  source_version text not null check (length(source_version) between 1 and 80),
  category text not null check (length(category) between 1 and 120),
  mode text not null check (mode in ('study', 'review', 'exam')),
  exam_id uuid,
  answered_at timestamptz not null,
  received_at timestamptz not null default clock_timestamp(),
  selected jsonb not null check (jsonb_typeof(selected) = 'array'),
  correct jsonb not null check (jsonb_typeof(correct) = 'array'),
  answer_format text,
  is_correct boolean not null,
  duration_ms integer not null check (duration_ms between 0 and 86400000),
  attempt_number integer not null check (attempt_number > 0),
  prior_incorrect_count integer not null check (prior_incorrect_count >= 0),
  review_correct boolean,
  reward smallint not null check (reward in (0, 1)),
  primary key (user_id, event_id),
  check ((mode = 'exam') = (exam_id is not null)),
  check ((mode = 'review') = (review_correct is not null))
);

create index learning_events_user_answered_idx
  on public.learning_events (user_id, answered_at desc);
create index learning_events_user_question_idx
  on public.learning_events (user_id, certification_id, question_id, question_revision);
create index learning_events_user_exam_idx
  on public.learning_events (user_id, exam_id) where exam_id is not null;
create unique index learning_events_one_exam_answer_idx
  on public.learning_events (user_id, exam_id, question_id, question_revision)
  where mode = 'exam';

create table public.exam_sessions (
  user_id uuid not null references auth.users(id) on delete cascade,
  exam_id uuid primary key,
  start_hash bytea not null,
  certification_id text not null check (length(certification_id) between 1 and 80),
  source_version text not null check (length(source_version) between 1 and 80),
  question_order jsonb not null check (jsonb_typeof(question_order) = 'array'),
  started_at timestamptz not null default clock_timestamp(),
  deadline_at timestamptz not null,
  position integer not null default 0 check (position >= 0),
  revision bigint not null default 0,
  state text not null default 'draft' check (state in ('draft', 'submitted')),
  submitted_at timestamptz,
  submission_hash bytea,
  unique (user_id, exam_id),
  check (deadline_at > started_at),
  check ((state = 'submitted') = (submitted_at is not null)),
  check ((state = 'submitted') = (submission_hash is not null))
);

alter table public.learning_events add constraint learning_events_exam_owner_fk
  foreign key (user_id, exam_id) references public.exam_sessions(user_id, exam_id) on delete cascade;

create table public.exam_responses (
  user_id uuid not null,
  exam_id uuid not null,
  question_key text not null check (length(question_key) between 1 and 200),
  selected jsonb not null check (jsonb_typeof(selected) = 'array'),
  flagged boolean not null default false,
  duration_ms integer not null check (duration_ms between 0 and 86400000),
  selected_at timestamptz,
  updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, exam_id, question_key),
  foreign key (user_id, exam_id) references public.exam_sessions(user_id, exam_id) on delete cascade
);

create table public.earned_certifications (
  user_id uuid not null references auth.users(id) on delete cascade,
  certification_id text not null check (length(certification_id) between 1 and 80),
  recorded_at timestamptz not null default clock_timestamp(),
  primary key (user_id, certification_id)
);

create table public.assessment_answers (
  user_id uuid not null references auth.users(id) on delete cascade,
  assessment_id text not null check (length(assessment_id) between 1 and 160),
  answer integer not null,
  updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, assessment_id)
);

create table public.migration_manifests (
  user_id uuid not null references auth.users(id) on delete cascade,
  manifest_id uuid primary key,
  source_name text not null check (source_name in (
    'history-local-storage', 'wrong-cookie-v1', 'exam-draft-local-storage', 'profile-local-storage'
  )),
  source_schema_version integer not null check (source_schema_version > 0),
  source_fingerprint text not null check (source_fingerprint ~ '^[0-9a-f]{64}$'),
  declared_rows integer not null check (declared_rows >= 0),
  status text not null default 'started' check (status in ('started', 'completed', 'failed')),
  completed_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  unique (user_id, manifest_id),
  unique (user_id, source_name, source_fingerprint),
  check ((status = 'completed') = (completed_at is not null))
);

create table public.migration_items (
  user_id uuid not null,
  manifest_id uuid not null,
  source_row_id text not null check (length(source_row_id) between 1 and 200),
  event_id uuid,
  outcome text not null check (outcome in ('accepted', 'rejected')),
  reason_code text,
  primary key (user_id, manifest_id, source_row_id),
  foreign key (user_id, manifest_id) references public.migration_manifests(user_id, manifest_id) on delete cascade
);

alter table public.learning_events enable row level security;
alter table public.learning_state enable row level security;
alter table public.exam_sessions enable row level security;
alter table public.exam_responses enable row level security;
alter table public.earned_certifications enable row level security;
alter table public.assessment_answers enable row level security;
alter table public.migration_manifests enable row level security;
alter table public.migration_items enable row level security;

create policy learning_events_read on public.learning_events for select to authenticated using (user_id = auth.uid());
create policy learning_state_read on public.learning_state for select to authenticated using (user_id = auth.uid());
create policy exam_sessions_read on public.exam_sessions for select to authenticated using (user_id = auth.uid());
create policy exam_responses_read on public.exam_responses for select to authenticated using (user_id = auth.uid());
create policy earned_certifications_read on public.earned_certifications for select to authenticated using (user_id = auth.uid());
create policy assessment_answers_read on public.assessment_answers for select to authenticated using (user_id = auth.uid());
create policy migration_manifests_read on public.migration_manifests for select to authenticated using (user_id = auth.uid());
create policy migration_items_read on public.migration_items for select to authenticated using (user_id = auth.uid());

revoke all on table public.learning_state, public.learning_events, public.exam_sessions, public.exam_responses,
  public.earned_certifications, public.assessment_answers, public.migration_manifests,
  public.migration_items from public, anon;
revoke insert, update, delete on table public.learning_events, public.exam_sessions,
  public.exam_responses, public.earned_certifications, public.assessment_answers,
  public.migration_manifests, public.migration_items from authenticated;
grant select on table public.learning_state, public.learning_events, public.exam_sessions, public.exam_responses,
  public.earned_certifications, public.assessment_answers, public.migration_manifests,
  public.migration_items to authenticated;

create table public.roadmap_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 0
);
alter table public.roadmap_profiles enable row level security;
create policy roadmap_profiles_read on public.roadmap_profiles for select to authenticated
  using (user_id = auth.uid());
revoke all on public.roadmap_profiles from public, anon, authenticated;
grant select on public.roadmap_profiles to authenticated;
