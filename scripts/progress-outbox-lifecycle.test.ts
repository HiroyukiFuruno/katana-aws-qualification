import { expect, test } from 'bun:test';
import type { Attempt } from '../src/attempts';
import { createProgressStore, type ProgressRpcClient } from '../src/progress';
import { MemberRetryQueue } from '../src/progress/retryQueue';
import { memoryStorage } from './progress-store-fixture';

const owner = { kind: 'member' as const, generation: 1, userId: 'member-a' };
function attempt(questionId = 'q-1'): Attempt {
  return {
    answeredAt: '2026-11-20T00:00:00.000Z',
    attemptNumber: 1,
    category: 'test',
    correct: ['A'],
    durationMs: 1,
    isCorrect: true,
    mode: 'study',
    priorIncorrectCount: 0,
    questionId,
    questionRevision: 1,
    reviewCorrect: null,
    reward: 1,
    schemaVersion: 1,
    selected: ['A'],
    sourceVersion: '2026-11',
  };
}

test('discarding an owner outbox removes events written by another tab', async () => {
  const storage = memoryStorage();
  const first = new MemberRetryQueue(owner, storage);
  const second = new MemberRetryQueue(owner, storage);
  await Promise.all([first.setServerGeneration(4), second.setServerGeneration(4)]);
  await first.enqueue('saa-c03', attempt());

  await second.discard();
  const restored = new MemberRetryQueue(owner, storage);
  await restored.setServerGeneration(4);
  expect(restored.hasPending()).toBe(false);
});

test('clearing one queue preserves an event from another tab', async () => {
  const storage = memoryStorage();
  const first = new MemberRetryQueue(owner, storage);
  const second = new MemberRetryQueue(owner, storage);
  await Promise.all([first.setServerGeneration(4), second.setServerGeneration(4)]);
  await first.enqueue('saa-c03', attempt());
  await second.enqueue('saa-c03', attempt('q-2'));

  await first.clear();
  const restored = new MemberRetryQueue(owner, storage);
  await restored.setServerGeneration(4);
  expect([...restored.pending.values()][0]?.attempt.questionId).toBe('q-2');
});

test('disposing a member store discards an owner outbox it did not load', async () => {
  const storage = memoryStorage();
  const client: ProgressRpcClient = {
    async rpc(name) {
      if (name === 'initialize_learning_state') return 1;
      if (name === 'load_roadmap_profile_snapshot_v2') return [];
    },
    async select() {
      return [];
    },
  };
  const store = createProgressStore({ client, isCurrent: () => true, owner, storage });
  await store.initialize();
  const anotherTab = new MemberRetryQueue(owner, storage);
  await anotherTab.setServerGeneration(1);
  await anotherTab.enqueue('saa-c03', attempt());

  await store.dispose(true);
  const restored = new MemberRetryQueue(owner, storage);
  await restored.setServerGeneration(1);
  expect(restored.hasPending()).toBe(false);
});
