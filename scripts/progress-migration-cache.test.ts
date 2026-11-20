import { expect, test } from 'bun:test';
import type { MigrationContext } from '../src/progress/migrationContext';
import { isCompletedExamCache } from '../src/progress/migrationDraftUpload';
import { type Question, questionKey } from '../src/questions';

test('completed exam cache matches submitted history without creating a draft', async () => {
  const question = {
    id: 'q-1',
    revision: 1,
    category: 'security',
    version: 'v1',
    title: 'Question',
    prompt: 'Choose',
    choices: [{ id: 'A', text: 'A', explanation: 'A' }],
    correct: ['A'],
    source: { url: 'https://example.test', label: 'source' },
  } satisfies Question;
  const key = questionKey(question);
  const draft = {
    id: '20000000-0000-0000-0000-000000000001',
    deadline: Date.parse('2026-11-20T00:05:00Z'),
    order: [key],
    position: 0,
    responses: {
      [key]: {
        selected: ['A'],
        flagged: true,
        durationMs: 1000,
        selectedAt: Date.parse('2026-11-20T00:10:00Z'),
      },
    },
  };
  const context = {
    select: async () => [
      {
        exam_id: draft.id,
        certification_id: 'saa-c03',
        source_version: 'v1',
        question_order: [{ question_id: 'q-1', question_revision: 1 }],
        state: 'submitted',
      },
    ],
    repository: {
      async loadAttempts() {
        return [
          {
            examId: draft.id,
            mode: 'exam',
            questionId: 'q-1',
            questionRevision: 1,
            sourceVersion: 'v1',
            category: 'security',
            format: undefined,
            correct: ['A'],
            selected: ['A'],
            isCorrect: true,
            answeredAt: '2026-11-20T00:05:00.000Z',
            durationMs: 1200,
          },
        ];
      },
    },
  } as unknown as MigrationContext;
  expect(await isCompletedExamCache(context, draft, [{ certificationId: 'saa-c03', question }])).toBe(
    true,
  );
  expect(
    await isCompletedExamCache(
      context,
      {
        ...draft,
        responses: { [key]: { ...draft.responses[key], selected: [] } },
      },
      [{ certificationId: 'saa-c03', question }],
    ),
  ).toBe(false);
});
