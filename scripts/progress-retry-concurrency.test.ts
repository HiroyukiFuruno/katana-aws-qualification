import { expect, test } from 'bun:test';
import type { Attempt } from '../src/attempts';
import { MemberRetryQueue } from '../src/progress/retryQueue';
import { memoryStorage } from './progress-store-fixture';

const owner = { kind: 'member' as const, generation: 1, userId: 'member-a' };
const answer: Attempt = {
  answeredAt: '2026-11-20T00:00:00.000Z',
  attemptNumber: 1,
  category: 'test',
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
  sourceVersion: '2026-11',
};
test('shared outbox updates use the browser Web Lock for concurrent tabs', async () => {
  const original = globalThis.navigator;
  let tail = Promise.resolve();
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      locks: {
        request: <T>(_name: string, action: () => Promise<T>) => {
          const run = tail.then(action);
          tail = run.then(
            () => undefined,
            () => undefined,
          );
          return run;
        },
      },
    },
  });
  try {
    const local = memoryStorage();
    const first = new MemberRetryQueue(owner, local);
    const second = new MemberRetryQueue(owner, local);
    await Promise.all([first.setServerGeneration(4), second.setServerGeneration(4)]);
    await Promise.all([
      first.enqueue('saa-c03', answer),
      second.enqueue('saa-c03', { ...answer, questionId: 'q-2' }),
    ]);
    const restored = new MemberRetryQueue(owner, local);
    await restored.setServerGeneration(4);
    expect(restored.pending.size).toBe(2);
  } finally {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: original });
  }
});
