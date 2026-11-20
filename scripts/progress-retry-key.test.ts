import { expect, test } from 'bun:test';
import type { Attempt } from '../src/attempts';
import { MemberRetryQueue } from '../src/progress/retryQueue';

const owner = { kind: 'member' as const, generation: 1, userId: 'member-a' };

function attempt(selected: string[], format?: Attempt['format']): Attempt {
  return {
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
    selected,
    sourceVersion: '2026-11',
    ...(format ? { format } : {}),
  };
}

test('retry keys preserve structured answer order but normalize ordinary choices', () => {
  const queue = new MemberRetryQueue(owner);
  const choices = queue.enqueue('saa-c03', attempt(['A', 'B']));
  expect(queue.enqueue('saa-c03', attempt(['B', 'A']))).toBe(choices);

  const ordered = queue.enqueue('saa-c03', attempt(['A', 'B'], 'ordering'));
  expect(queue.enqueue('saa-c03', attempt(['B', 'A'], 'ordering'))).not.toBe(ordered);

  const matched = queue.enqueue('saa-c03', attempt(['A', 'B'], 'matching'));
  expect(matched).not.toBe(ordered);
});
