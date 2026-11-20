import type { Attempt } from '../src/attempts';
import { createProgressStore, type ProgressRpcClient } from '../src/progress';

const identifying = {
  category: 'storage',
  questionId: 'q-1',
  questionRevision: 1,
  schemaVersion: 1,
  sourceVersion: '2026-11',
} as const;
const outcome = {
  answeredAt: '2026-11-20T00:00:00.000Z',
  attemptNumber: 1,
  correct: ['a'],
  durationMs: 100,
  isCorrect: true,
  mode: 'study',
  priorIncorrectCount: 0,
  reviewCorrect: null,
  reward: 1,
  selected: ['a'],
} as const;

export const memberAttempt: Attempt = { ...identifying, ...outcome };

export function memberStore(client: ProgressRpcClient) {
  return createProgressStore({
    client,
    isCurrent: () => true,
    owner: { kind: 'member', generation: 1, userId: 'member-a' },
    storage: { getItem: () => null, removeItem: () => {}, setItem: () => {} },
  });
}
