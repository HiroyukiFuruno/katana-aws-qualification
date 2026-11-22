import type { PublicTable, RawRow } from '../supabase/functions/account-linking/merge/types.ts';
import { rawColumns } from '../supabase/functions/account-linking/merge/validation.ts';
import { eventFixture } from './account-merge-preview-event.test.ts';

export const fixtureDigest = (seed: string) => seed.repeat(64).slice(0, 64);

export function fixtureRow(table: PublicTable, user_id: string, suffix: string): RawRow {
  const value = Object.fromEntries(rawColumns[table].map((column) => [column, null]));
  return { ...value, user_id, ...overrides(table, suffix) };
}

function overrides(table: PublicTable, suffix: string): RawRow {
  const id = `33333333-3333-4333-8333-33333333333${suffix}`;
  const updated_at = `2026-01-0${suffix}T00:00:00Z`;
  const revision = suffix === '1' ? 1 : 2;
  switch (table) {
    case 'learning_state':
      return { generation: 0 };
    case 'learning_events':
      return eventFixture(suffix);
    case 'exam_sessions':
      return {
        exam_id: id,
        start_hash: '\\xaa',
        certification_id: 'cert',
        source_version: 'v1',
        question_order: [],
        legacy_import: false,
        started_at: '2026-01-01T00:00:00Z',
        deadline_at: '2026-01-02T00:00:00Z',
        position: 0,
        revision,
        state: 'draft',
        submitted_at: null,
        submitted_received_at: null,
        submission_hash: null,
        presentation: { choiceOrders: {} },
      };
    case 'exam_responses':
      return {
        exam_id: id,
        question_key: 'q',
        selected: [],
        flagged: false,
        duration_ms: 1,
        selected_at: null,
        updated_at,
      };
    case 'earned_certifications':
      return { certification_id: 'cert', recorded_at: `2026-01-0${suffix}T00:00:00Z` };
    case 'assessment_answers':
      return { assessment_id: 'assessment', answer: Number(suffix), updated_at };
    case 'migration_manifests':
      return {
        manifest_id: id,
        source_name: 'history-local-storage',
        source_schema_version: 1,
        source_fingerprint: fixtureDigest('a'),
        declared_rows: Number(suffix),
        status: 'completed',
        completed_at: '2026-01-01T00:00:00Z',
        created_at: '2026-01-01T00:00:00Z',
      };
    case 'migration_items':
      return {
        manifest_id: id,
        source_row_id: `row-${suffix}`,
        event_id: null,
        exam_id: null,
        import_kind: 'roadmap-profile',
        payload_hash: '\\xaa',
        outcome: 'accepted',
        reason_code: null,
        presentation_hash: `\\x${'a'.repeat(64)}`,
      };
    case 'roadmap_profiles':
      return { revision: Number(suffix), presentation: { optionOrders: {}, order: [] } };
    case 'dashboard_settings':
      return {
        revision,
        settings: { schemaVersion: 1, filters: {}, widgets: [{ id: suffix }] },
        updated_at,
      };
    case 'fundamentals_unit_progress':
      return {
        unit_id: 'unit',
        content_version: 'v1',
        completed_slide_ids: [`slide-${suffix}`],
        completed_checkpoint_ids: [`check-${suffix}`],
        furthest_plan_position: Number(suffix),
        resume_stage: 'slide',
        resume_step_id: null,
        active_final_session_id: id,
        passed_final_session_id: null,
        passed_at: null,
        revision,
        last_mutation_id: null,
        last_mutation_hash: null,
        updated_at,
      };
    case 'fundamentals_final_sessions':
      return {
        session_id: id,
        unit_id: 'unit',
        content_version: 'v1',
        catalog_hash: '\\xaa',
        start_hash: '\\xbb',
        question_order: [],
        responses: {},
        position: 0,
        state: 'draft',
        score: null,
        required_score: 1,
        passed: null,
        started_at: '2026-01-01T00:00:00Z',
        submitted_at: null,
        submitted_received_at: null,
        submission_hash: null,
        revision,
        last_response_receipt_id: null,
        last_response_receipt_hash: null,
      };
  }
}
