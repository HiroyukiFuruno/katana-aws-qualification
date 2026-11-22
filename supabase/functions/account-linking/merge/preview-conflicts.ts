import { option, remaps } from './preview-remaps.ts';
import { group } from './preview-values.ts';
import type { Conflict, ProjectionPlan, RetainedRow, Selection } from './types.ts';
import { utcMillis } from './validation-used.ts';

function select(
  plan: ProjectionPlan,
  selection: Selection,
  table: Conflict['table'],
  kind: string,
  detail: Record<string, unknown>,
) {
  if (plan.requiredSelections.some((item) => item.id === selection.id)) return;
  plan.requiredSelections.push(selection);
  plan.conflicts.push({ table, kind, identities: selection.options, selectionId: selection.id, detail });
}

export function addConflicts(plan: ProjectionPlan) {
  const rows = (table: RetainedRow['table']) => plan.retained.filter((row) => row.table === table);
  remaps(plan, 'learning_events', 'event-id-remap-required', () => []);
  remaps(plan, 'exam_sessions', 'exam-id-remap-required', (id) =>
    rows('exam_responses').filter((row) => row.raw.exam_id === id),
  );
  remaps(plan, 'fundamentals_final_sessions', 'final-session-id-remap-required', (id) =>
    rows('fundamentals_unit_progress').filter(
      (row) => row.raw.active_final_session_id === id || row.raw.passed_final_session_id === id,
    ),
  );
  remaps(plan, 'migration_manifests', 'manifest-id-remap-required', (id) =>
    rows('migration_items').filter((row) => row.raw.manifest_id === id),
  );
  for (const [key, items] of group(rows('assessment_answers'), (row) => row.identity))
    if (new Set(items.map((item) => item.raw.answer)).size > 1)
      select(
        plan,
        {
          id: `assessment:${key}`,
          kind: 'assessment',
          options: items.map((item) => `${item.provenance}:${key}`),
        },
        'assessment_answers',
        'assessment-answer-choice',
        {},
      );
  const dashboards = rows('dashboard_settings');
  if (
    dashboards.length > 1 &&
    new Set(dashboards.map((item) => JSON.stringify(item.raw.settings))).size > 1
  )
    select(
      plan,
      { id: 'dashboard', kind: 'dashboard', options: dashboards.map((item) => item.provenance) },
      'dashboard_settings',
      'dashboard-whole-setting-choice',
      {},
    );
  const profiles = rows('roadmap_profiles');
  if (profiles.length > 1 && new Set(profiles.map((item) => item.raw.revision)).size > 1)
    select(
      plan,
      { id: 'roadmap', kind: 'roadmap', options: profiles.map((item) => item.provenance) },
      'roadmap_profiles',
      'roadmap-revision-choice',
      { nextRevisionFloor: Math.max(...profiles.map((item) => Number(item.raw.revision))) + 1 },
    );
  certificates(plan, rows('earned_certifications'));
  draftSelections(
    plan,
    rows('exam_sessions'),
    rows('fundamentals_final_sessions'),
    rows('migration_manifests'),
  );
}

function certificates(plan: ProjectionPlan, rows: RetainedRow[]) {
  for (const [key, items] of group(rows, (item) => item.identity)) {
    if (items.length < 2) continue;
    const dates = items
      .map((item) => ({
        value: item.raw.recorded_at,
        time: utcMillis(item.raw.recorded_at, 'recorded_at'),
      }))
      .sort((left, right) => left.time - right.time);
    plan.conflicts.push({
      table: 'earned_certifications',
      kind: 'certification-earliest-recorded-at-candidate',
      identities: [key],
      detail: { earliestRecordedAt: dates[0]?.value },
    });
  }
}

function draftSelections(
  plan: ProjectionPlan,
  exams: RetainedRow[],
  finals: RetainedRow[],
  manifests: RetainedRow[],
) {
  for (const [key, items] of group(
    exams.filter((item) => item.raw.state === 'draft'),
    (item) => String(item.raw.certification_id),
  ))
    if (items.length > 1)
      select(
        plan,
        { id: `exam:${key}`, kind: 'exam-resume', options: items.map(option) },
        'exam_sessions',
        'exam-draft-resume-choice',
        {},
      );
  for (const [key, items] of group(
    finals.filter((item) => item.raw.state === 'draft'),
    (item) => `${item.raw.unit_id}:${item.raw.content_version}`,
  ))
    if (items.length > 1)
      select(
        plan,
        { id: `final:${key}`, kind: 'final-resume', options: items.map(option) },
        'fundamentals_final_sessions',
        'final-draft-resume-choice',
        {},
      );
  for (const [key, items] of group(
    manifests,
    (item) => `${item.raw.source_name}:${item.raw.source_fingerprint}`,
  ))
    if (items.length > 1)
      select(
        plan,
        { id: `manifest:${key}`, kind: 'manifest-head', options: items.map(option) },
        'migration_manifests',
        'manifest-replay-head-choice',
        {},
      );
}
