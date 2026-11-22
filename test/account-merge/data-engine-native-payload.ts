import { randomUUID } from 'node:crypto';
import { expect } from '@playwright/test';
import { sql } from './commands';
import { type NativeOwner, rpc } from './data-engine-native-support';
import { quoted } from './owner-shadow-support';

export type GuestVariants = {
  eventId: string;
  examId: string;
  fingerprint: string;
  importedEventId: string;
  manifests: string[];
};

export async function createGuestVariants(
  first: NativeOwner,
  second: NativeOwner,
): Promise<GuestVariants> {
  const fingerprint = 'a'.repeat(64);
  const eventId = randomUUID();
  const examId = randomUUID();
  const importedEventId = randomUUID();
  const manifests: string[] = [];
  for (const owner of [first, second]) {
    expect(await rpc(owner, 'initialize_learning_state', {})).not.toBeNull();
    const manifest = randomUUID();
    manifests.push(manifest);
    expect(
      await rpc(owner, 'begin_migration', {
        p_expected_generation: 0,
        p_manifest_id: manifest,
        p_source_name: 'history-local-storage',
        p_schema_version: 1,
        p_fingerprint: fingerprint,
        p_declared_rows: 2,
      }),
    ).toBe(manifest);
    expect(
      await rpc(owner, 'append_learning_event', {
        p_expected_generation: 0,
        p_manifest_id: manifest,
        p_source_row_id: 'history-0',
        p_event: {
          event_id: eventId,
          schema_version: 1,
          certification_id: 'saa-c03',
          question_id: 'guest-history',
          question_revision: 1,
          source_version: 'guest-v1',
          category: 'security',
          mode: 'study',
          answered_at: '2026-01-01T00:00:00Z',
          selected: ['A'],
          correct: ['A'],
          is_correct: true,
          duration_ms: 1,
          attempt_number: 1,
          prior_incorrect_count: 0,
          reward: 1,
        },
      }),
    ).not.toBeNull();
    expect(
      await rpc(owner, 'import_exam_session', {
        p_expected_generation: 0,
        p_manifest_id: manifest,
        p_source_row_id: 'exam-0',
        p_exam: {
          exam_id: examId,
          certification_id: 'saa-c03',
          source_version: 'guest-v1',
          question_order: [{ question_id: 'guest-exam', question_revision: 1 }],
          legacy_import: true,
          state: 'submitted',
          position: 0,
        },
        p_draft_responses: [],
        p_events: [
          {
            event_id: importedEventId,
            schema_version: 1,
            certification_id: 'saa-c03',
            question_id: 'guest-exam',
            question_revision: 1,
            source_version: 'guest-v1',
            category: 'security',
            mode: 'exam',
            exam_id: examId,
            answered_at: '2026-01-01T00:00:00Z',
            selected: ['A'],
            correct: ['A'],
            is_correct: true,
            duration_ms: 1,
            attempt_number: 1,
            prior_incorrect_count: 0,
            reward: 1,
          },
        ],
      }),
    ).not.toBeNull();
  }
  expect(
    JSON.parse(
      sql(`select jsonb_build_object(
        'manifests', (select count(*) from public.migration_manifests where user_id in (${quoted(first.userId)},${quoted(second.userId)}) and source_name = 'history-local-storage' and source_fingerprint = '${fingerprint}'),
        'items', (select count(*) from public.migration_items where user_id in (${quoted(first.userId)},${quoted(second.userId)}) and outcome = 'accepted'),
        'study_events', (select count(*) from public.learning_events where user_id in (${quoted(first.userId)},${quoted(second.userId)}) and mode = 'study' and event_id = ${quoted(eventId)}),
        'exam_events', (select count(*) from public.learning_events where user_id in (${quoted(first.userId)},${quoted(second.userId)}) and mode = 'exam' and event_id = ${quoted(importedEventId)} and exam_id = ${quoted(examId)}),
        'submitted_legacy_exams', (select count(*) from public.exam_sessions where user_id in (${quoted(first.userId)},${quoted(second.userId)}) and exam_id = ${quoted(examId)} and legacy_import and state = 'submitted')
      )`),
    ),
  ).toEqual({ manifests: 2, items: 4, study_events: 2, exam_events: 2, submitted_legacy_exams: 2 });
  return { eventId, examId, fingerprint, importedEventId, manifests };
}
