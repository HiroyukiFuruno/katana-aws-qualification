import { randomUUID } from 'node:crypto';
import { expect } from '@playwright/test';
import { sql } from './commands';
import { type NativeOwner, rpc } from './data-engine-native-support';
import { quoted } from './owner-shadow-support';

export type NonLegacyGuestVariants = {
  draftExamId: string;
  draftQuestionKey: string;
  submittedEventId: string;
  submittedExamId: string;
};

export async function createNonLegacyGuestVariants(
  first: NativeOwner,
  second: NativeOwner,
  manifests: string[],
): Promise<NonLegacyGuestVariants> {
  const submittedExamId = randomUUID();
  const submittedEventId = randomUUID();
  const draftExamId = randomUUID();
  const draftQuestion = { question_id: 'guest-draft-exam', question_revision: 1 };
  const draftQuestionKey = JSON.stringify(draftQuestion);
  const submittedQuestion = { question_id: 'guest-submitted-exam', question_revision: 1 };

  for (const [index, owner] of [first, second].entries()) {
    const manifest = manifests[index];
    if (!manifest) throw new Error('Missing guest migration manifest');
    expect(
      await rpc(owner, 'import_exam_session', {
        p_expected_generation: 0,
        p_manifest_id: manifest,
        p_source_row_id: 'nonlegacy-submitted-0',
        p_exam: {
          exam_id: submittedExamId,
          certification_id: 'saa-c03',
          source_version: 'guest-v2',
          question_order: [submittedQuestion],
          legacy_import: false,
          state: 'submitted',
          started_at: '2026-01-01T00:00:00Z',
          deadline_at: '2026-01-01T00:10:00Z',
          submitted_at: '2026-01-01T00:05:00Z',
          position: 0,
        },
        p_draft_responses: [],
        p_events: [
          {
            event_id: submittedEventId,
            schema_version: 1,
            certification_id: 'saa-c03',
            question_id: submittedQuestion.question_id,
            question_revision: submittedQuestion.question_revision,
            source_version: 'guest-v2',
            category: 'security',
            mode: 'exam',
            exam_id: submittedExamId,
            answered_at: '2026-01-01T00:04:00Z',
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
    ).toBe(submittedExamId);
    expect(
      await rpc(owner, 'import_exam_session', {
        p_expected_generation: 0,
        p_manifest_id: manifest,
        p_source_row_id: 'nonlegacy-draft-0',
        p_exam: {
          exam_id: draftExamId,
          certification_id: 'saa-c03',
          source_version: 'guest-v2',
          question_order: [draftQuestion],
          legacy_import: false,
          state: 'draft',
          started_at: '2026-01-01T00:00:00Z',
          deadline_at: '2099-01-01T00:10:00Z',
          position: 0,
        },
        p_draft_responses: [
          {
            question_ref: draftQuestion,
            selected: ['A'],
            flagged: true,
            duration_ms: 7,
            selected_at: '2026-01-01T00:01:00Z',
          },
        ],
        p_events: [],
      }),
    ).toBe(draftExamId);
  }

  const owners = `${quoted(first.userId)},${quoted(second.userId)}`;
  expect(
    JSON.parse(
      sql(`select jsonb_build_object(
        'submitted_payload_hashes', (select count(distinct encode(payload_hash,'hex')) from public.migration_items
          where user_id in (${owners}) and source_row_id = 'nonlegacy-submitted-0'),
        'submitted_received_at', (select count(distinct submitted_received_at) from public.exam_sessions
          where user_id in (${owners}) and exam_id = ${quoted(submittedExamId)}),
        'draft_payload_hashes', (select count(distinct encode(payload_hash,'hex')) from public.migration_items
          where user_id in (${owners}) and source_row_id = 'nonlegacy-draft-0'),
        'draft_updated_at', (select count(distinct updated_at) from public.exam_responses
          where user_id in (${owners}) and exam_id = ${quoted(draftExamId)})
      )::text`),
    ),
  ).toEqual({
    submitted_payload_hashes: 1,
    submitted_received_at: 2,
    draft_payload_hashes: 1,
    draft_updated_at: 2,
  });
  return { draftExamId, draftQuestionKey, submittedEventId, submittedExamId };
}
