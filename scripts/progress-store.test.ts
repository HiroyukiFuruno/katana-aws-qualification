import { expect, test } from 'bun:test';
import type { Attempt } from '../src/attempts';
import { historyKey } from '../src/history';
import { createProgressStore, type ProgressRpcClient } from '../src/progress';
import { memoryStorage } from './progress-store-fixture';

const attempt: Attempt = {
  answeredAt: '2026-11-20T00:00:00.000Z',
  attemptNumber: 1,
  category: 'storage',
  correct: ['a'],
  durationMs: 100,
  isCorrect: true,
  mode: 'study',
  priorIncorrectCount: 0,
  questionId: 'q-1',
  questionRevision: 1,
  reviewCorrect: null,
  reward: 1,
  schemaVersion: 1,
  selected: ['a'],
  sourceVersion: '2026-11',
};

test('a guest without learning-record consent keeps progress only in memory', async () => {
  const local = memoryStorage();
  const store = createProgressStore({
    isCurrent: () => true,
    owner: { kind: 'guest', generation: 1 },
    storage: local,
  });
  await store.initialize();
  await store.appendAttempt('saa-c03', attempt);
  expect(store.getSnapshot().attempts).toEqual([attempt]);
  expect(local.getItem(historyKey)).toBeNull();
});

test('corrupt guest rows are reported without deleting the original payload', async () => {
  const local = memoryStorage();
  local.setItem('katana.learning-progress-consent.v1', 'granted');
  local.setItem(historyKey, JSON.stringify([attempt, { schemaVersion: 1, questionId: 3 }]));
  const store = createProgressStore({
    isCurrent: () => true,
    owner: { kind: 'guest', generation: 1 },
    storage: local,
  });
  await store.initialize();
  expect(store.getSnapshot()).toMatchObject({ corruptRows: 1 });
  expect(store.getSnapshot().attempts).toEqual([attempt]);
  expect(local.getItem(historyKey)).toContain('questionId');
});

test('a later cloud-load failure retains the last successful member snapshot', async () => {
  let fail = false;
  const client: ProgressRpcClient = {
    async rpc<T>(name) {
      if (fail) throw new Error('offline');
      return (name === 'load_roadmap_profile_snapshot_v2' ? [] : 0) as T;
    },
    async select(table) {
      if (fail) throw new Error('offline');
      if (table === 'roadmap_profiles') return [];
      return [
        {
          answer_format: undefined,
          answered_at: attempt.answeredAt,
          attempt_number: attempt.attemptNumber,
          category: attempt.category,
          certification_id: 'saa-c03',
          correct: attempt.correct,
          duration_ms: attempt.durationMs,
          event_id: 'event-1',
          is_correct: attempt.isCorrect,
          mode: attempt.mode,
          prior_incorrect_count: attempt.priorIncorrectCount,
          question_id: attempt.questionId,
          question_revision: attempt.questionRevision,
          review_correct: attempt.reviewCorrect,
          reward: attempt.reward,
          schema_version: attempt.schemaVersion,
          selected: attempt.selected,
          source_version: attempt.sourceVersion,
        },
      ];
    },
  };
  const store = createProgressStore({
    client,
    isCurrent: () => true,
    owner: { kind: 'member', generation: 1, userId: 'member-a' },
    storage: memoryStorage(),
  });
  await store.initialize();
  fail = true;
  await store.initialize();
  expect(store.getSnapshot()).toMatchObject({ error: 'load', state: 'ready' });
  expect(store.getSnapshot().attempts).toHaveLength(1);
  expect(store.getSnapshot().attempts[0]).toMatchObject(attempt);
});
