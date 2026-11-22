import type { RawRow } from '../supabase/functions/account-linking/merge/types.ts';

export function eventFixture(suffix: string): RawRow {
  return {
    event_id: 'event-shared',
    payload_hash: `\\xaa${suffix}`,
    schema_version: 1,
    certification_id: 'cert',
    question_id: 'q',
    question_revision: 1,
    source_version: 'v1',
    category: 'core',
    mode: 'study',
    exam_id: null,
    answered_at: '2026-01-01T00:00:00Z',
    received_at: '2026-01-01T00:00:00Z',
    selected: [],
    correct: [],
    answer_format: null,
    is_correct: true,
    duration_ms: 1,
    attempt_number: 1,
    prior_incorrect_count: 0,
    review_correct: null,
    reward: 1,
    fundamentals_session_id: null,
    learning_context: null,
    selection_polarity: null,
    required_choices: null,
  };
}
