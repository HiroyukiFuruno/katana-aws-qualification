import { expect, test } from 'bun:test';
import type { Attempt } from '../src/attempts';
import { uploadHistory } from '../src/progress/migrationHistoryUpload';
import type { MigrationContext } from '../src/progress/migrationContext';

const question = { certificationId: 'saa-c03', question: { id: 'q-1', revision: 1 } } as const;
const study: Attempt = {
  answeredAt: '2026-11-20T00:00:00.000Z',
  attemptNumber: 1,
  category: 'storage',
  correct: ['A'],
  durationMs: 1,
  isCorrect: true,
  mode: 'study',
  priorIncorrectCount: 0,
  questionId: 'q-1',
  questionRevision: 1,
  reviewCorrect: null,
  reward: 1,
  schemaVersion: 1,
  selected: ['A'],
  sourceVersion: 'v1',
};
const exam = { ...study, mode: 'exam' as const, examId: 'exam-1' };

function context(ids: string[]) {
  return {
    resolve: async () => question,
    reject: async () => {},
    repository: {
      write: async <T>(_name: string, args: Record<string, unknown>) => {
        const event = args.p_event as { event_id: string } | undefined;
        if (event) ids.push(event.event_id);
        const events = args.p_events as { event_id: string }[] | undefined;
        if (events) ids.push(...events.map((item) => item.event_id));
        return undefined as T;
      },
    },
  } as unknown as MigrationContext;
}

test('study event IDs survive a raw source rewrite while duplicate occurrences stay distinct', async () => {
  const first: string[] = [];
  const second: string[] = [];
  await uploadHistory(context(first), JSON.stringify([study]), 'manifest-a', 'raw-hash-a', false);
  await uploadHistory(
    context(second),
    JSON.stringify([{ reward: study.reward, extra: 'ignored', ...study }, study]),
    'manifest-b',
    'raw-hash-b',
    false,
  );
  expect(second[0]).toBe(first[0]);
  expect(second[1]).not.toBe(second[0]);
});

test('unknown fields and object key order do not change a valid event ID', async () => {
  const first: string[] = [];
  const rewritten: string[] = [];
  await uploadHistory(context(first), JSON.stringify([study]), 'manifest-a', 'raw-hash-a', false);
  await uploadHistory(
    context(rewritten),
    JSON.stringify([{ reward: study.reward, extra: 'ignored', ...study }]),
    'manifest-b',
    'raw-hash-b',
    false,
  );
  expect(rewritten).toEqual(first);
});

test('exam event IDs use the same stable occurrence identity', async () => {
  const first: string[] = [];
  const second: string[] = [];
  await uploadHistory(context(first), JSON.stringify([exam]), 'manifest-a', 'raw-hash-a', false);
  await uploadHistory(context(second), JSON.stringify([exam, exam]), 'manifest-b', 'raw-hash-b', false);
  expect(second[0]).toBe(first[0]);
  expect(second[1]).not.toBe(second[0]);
});
