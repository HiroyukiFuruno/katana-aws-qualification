import { expect, test } from 'bun:test';
import { hasImportedDraft, hasImportedEvents } from '../src/progress/migrationVerification';

const attempt = {
  schemaVersion: 1,
  questionId: 'q',
  questionRevision: 1,
  sourceVersion: 'v1',
  category: 'security',
  mode: 'study' as const,
  answeredAt: '2026-11-20T00:00:00.000Z',
  selected: ['A'],
  correct: ['A'],
  isCorrect: true,
  durationMs: 1200,
  attemptNumber: 1,
  priorIncorrectCount: 0,
  reviewCorrect: null,
  reward: 1,
};

test('accepts equivalent event timestamps and rejects invalid timestamps', () => {
  const event = {
    ...attempt,
    answeredAt: '2026-11-20T00:00:00+00:00',
    certificationId: 'saa-c03',
    eventId: 'event-1',
  };
  expect(hasImportedEvents([event], [{ attempt, certificationId: 'saa-c03', eventId: 'event-1' }])).toBe(
    true,
  );
  expect(
    hasImportedEvents(
      [{ ...event, answeredAt: 'not-a-timestamp' }],
      [{ attempt, certificationId: 'saa-c03', eventId: 'event-1' }],
    ),
  ).toBe(false);
});

test('matches legacy tuple keys with stored reference-object keys', () => {
  const draft = {
    id: '20000000-0000-0000-0000-000000000001',
    deadline: Date.parse('2026-11-20T01:00:00.000Z'),
    order: ['["q",1]'],
    position: 0,
    responses: {
      '["q",1]': {
        selected: ['A'],
        flagged: true,
        durationMs: 1200,
        selectedAt: Date.parse('2026-11-20T00:10:00.000Z'),
      },
    },
  };
  const sessions = [
    {
      exam_id: draft.id,
      deadline_at: '2026-11-20T01:00:00+00:00',
      position: 0,
      question_order: [{ question_id: 'q', question_revision: 1 }],
      state: 'draft',
    },
  ];
  const response = {
    exam_id: draft.id,
    question_key: '{"question_id":"q","question_revision":1}',
    selected: ['A'],
    flagged: true,
    duration_ms: 1200,
    selected_at: '2026-11-20T00:10:00+00:00',
  };
  expect(hasImportedDraft(draft, sessions, [response])).toBe(true);
  expect(hasImportedDraft(draft, sessions, [{ ...response, selected_at: 'not-a-timestamp' }])).toBe(
    false,
  );
});
