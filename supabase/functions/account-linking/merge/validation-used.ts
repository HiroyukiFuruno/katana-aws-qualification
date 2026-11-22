import type { PublicTable, RawRow } from './types.ts';

export function isRecord(value: unknown): value is RawRow {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function utcMillis(value: unknown, field: string): number {
  if (typeof value !== 'string' || !/(?:Z|[+-]\d\d:\d\d)$/.test(value))
    throw new Error(`merge row has invalid ${field}`);
  const time = Date.parse(value);
  if (!Number.isFinite(time)) throw new Error(`merge row has invalid ${field}`);
  return time;
}

function text(row: RawRow, field: string, nullable = false) {
  if (nullable && row[field] === null) return;
  if (typeof row[field] !== 'string' || !row[field]) throw new Error(`merge row has invalid ${field}`);
}

function finite(row: RawRow, field: string, nullable = false) {
  if (nullable && row[field] === null) return;
  if (typeof row[field] !== 'number' || !Number.isFinite(row[field]))
    throw new Error(`merge row has invalid ${field}`);
}

function time(row: RawRow, field: string, nullable = false) {
  if (nullable && row[field] === null) return;
  utcMillis(row[field], field);
}

function array(row: RawRow, field: string) {
  if (!Array.isArray(row[field])) throw new Error(`merge row has invalid ${field}`);
}

export function validateUsedRow(table: PublicTable, row: RawRow) {
  switch (table) {
    case 'learning_state':
      finite(row, 'generation');
      return;
    case 'learning_events':
      text(row, 'event_id');
      finite(row, 'schema_version');
      finite(row, 'question_revision');
      finite(row, 'duration_ms');
      finite(row, 'attempt_number');
      finite(row, 'prior_incorrect_count');
      time(row, 'answered_at');
      time(row, 'received_at');
      array(row, 'selected');
      array(row, 'correct');
      return;
    case 'exam_sessions':
      text(row, 'exam_id');
      text(row, 'certification_id');
      text(row, 'source_version');
      finite(row, 'position');
      finite(row, 'revision');
      array(row, 'question_order');
      if (typeof row.legacy_import !== 'boolean') throw new Error('merge row has invalid legacy_import');
      time(row, 'started_at', row.legacy_import);
      time(row, 'deadline_at', row.legacy_import);
      state(row, 'state');
      time(row, 'submitted_at', true);
      time(row, 'submitted_received_at', true);
      return;
    case 'exam_responses':
      text(row, 'exam_id');
      text(row, 'question_key');
      finite(row, 'duration_ms');
      array(row, 'selected');
      time(row, 'updated_at');
      return;
    case 'earned_certifications':
      text(row, 'certification_id');
      time(row, 'recorded_at');
      return;
    case 'assessment_answers':
      text(row, 'assessment_id');
      finite(row, 'answer');
      time(row, 'updated_at');
      return;
    case 'migration_manifests':
      text(row, 'manifest_id');
      text(row, 'source_name');
      text(row, 'source_fingerprint');
      finite(row, 'source_schema_version');
      finite(row, 'declared_rows');
      time(row, 'created_at');
      return;
    case 'migration_items':
      text(row, 'manifest_id');
      text(row, 'source_row_id');
      return;
    case 'roadmap_profiles':
      finite(row, 'revision');
      return;
    case 'dashboard_settings':
      finite(row, 'revision');
      time(row, 'updated_at');
      if (!isRecord(row.settings)) throw new Error('merge row has invalid settings');
      return;
    case 'fundamentals_unit_progress':
      text(row, 'unit_id');
      text(row, 'content_version');
      finite(row, 'furthest_plan_position');
      finite(row, 'revision');
      time(row, 'updated_at');
      array(row, 'completed_slide_ids');
      array(row, 'completed_checkpoint_ids');
      return;
    case 'fundamentals_final_sessions':
      text(row, 'session_id');
      text(row, 'unit_id');
      text(row, 'content_version');
      finite(row, 'position');
      finite(row, 'required_score');
      finite(row, 'revision');
      array(row, 'question_order');
      if (!isRecord(row.responses)) throw new Error('merge row has invalid responses');
      state(row, 'state');
      time(row, 'started_at');
      time(row, 'submitted_at', true);
      time(row, 'submitted_received_at', true);
      return;
  }
}

function state(row: RawRow, field: string) {
  if (row[field] !== 'draft' && row[field] !== 'submitted')
    throw new Error(`merge row has invalid ${field}`);
}
