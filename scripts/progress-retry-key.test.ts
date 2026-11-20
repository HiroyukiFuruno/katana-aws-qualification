import { expect, test } from 'bun:test';
import type { Attempt } from '../src/attempts';
import type { MemberProgressRepository } from '../src/progress/member';
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

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => void values.delete(key),
    setItem: (key: string, value: string) => void values.set(key, value),
  };
}

test('retry keys preserve structured answer order but normalize ordinary choices', async () => {
  const queue = new MemberRetryQueue(owner, {
    getItem: () => null,
    removeItem: () => {},
    setItem: () => {},
  });
  await queue.setServerGeneration(1);
  const choices = await queue.enqueue('saa-c03', attempt(['A', 'B']));
  expect(await queue.enqueue('saa-c03', attempt(['B', 'A']))).toBe(choices);

  const ordered = await queue.enqueue('saa-c03', attempt(['A', 'B'], 'ordering'));
  expect(await queue.enqueue('saa-c03', attempt(['B', 'A'], 'ordering'))).not.toBe(ordered);

  const matched = await queue.enqueue('saa-c03', attempt(['A', 'B'], 'matching'));
  expect(matched).not.toBe(ordered);
});

test('member outbox survives queue recreation and flushes the original UUID', async () => {
  const local = storage();
  const first = new MemberRetryQueue(owner, local);
  await first.setServerGeneration(4);
  const queued = await first.enqueue('saa-c03', attempt(['A']));
  const second = new MemberRetryQueue(owner, local);
  await second.setServerGeneration(4);
  expect(second.pending.get([...second.pending.keys()][0])).toEqual(queued);
  const received: string[] = [];
  const repository = {
    owner,
    append: async (event: { eventId: string }) => {
      received.push(event.eventId);
      return event.eventId;
    },
  } as MemberProgressRepository;
  await second.flush(repository);
  expect(received).toEqual([queued.eventId]);
  expect(local.getItem('katana.learning-outbox.v1.member-a')).toBeNull();
});

test('member outbox from an old server generation is discarded', async () => {
  const local = storage();
  const first = new MemberRetryQueue(owner, local);
  await first.setServerGeneration(4);
  await first.enqueue('saa-c03', attempt(['A']));
  const second = new MemberRetryQueue(owner, local);
  await second.setServerGeneration(5);
  expect(second.hasPending()).toBe(false);
  expect(local.getItem('katana.learning-outbox.v1.member-a')).toBeNull();
});

test('stale generation cleanup failure cannot resurrect pending events', async () => {
  const local = storage();
  const first = new MemberRetryQueue(owner, local);
  await first.setServerGeneration(4);
  await first.enqueue('saa-c03', attempt(['A']));
  local.removeItem = () => {
    throw new Error('storage unavailable');
  };
  const second = new MemberRetryQueue(owner, local);
  await expect(second.setServerGeneration(5)).rejects.toThrow('storage unavailable');
  expect(second.hasPending()).toBe(false);
});

test('member outbox storage failure rejects enqueue without retaining a false success', async () => {
  const local = storage();
  local.setItem = () => {
    throw new Error('storage unavailable');
  };
  const queue = new MemberRetryQueue(owner, local);
  await queue.setServerGeneration(4);
  await expect(queue.enqueue('saa-c03', attempt(['A']))).rejects.toThrow('storage unavailable');
  expect(queue.hasPending()).toBe(false);
});

test('two queues merge pending events in the shared owner outbox', async () => {
  const local = storage();
  const first = new MemberRetryQueue(owner, local);
  const second = new MemberRetryQueue(owner, local);
  await first.setServerGeneration(4);
  await second.setServerGeneration(4);
  await first.enqueue('saa-c03', attempt(['A']));
  await second.enqueue('saa-c03', { ...attempt(['B']), questionId: 'q-2' });
  const restored = new MemberRetryQueue(owner, local);
  await restored.setServerGeneration(4);
  expect(restored.pending.size).toBe(2);
});

test('two tabs retain separately identified identical pending answers after reload', async () => {
  const local = storage();
  const first = new MemberRetryQueue(owner, local);
  const second = new MemberRetryQueue(owner, local);
  await Promise.all([first.setServerGeneration(4), second.setServerGeneration(4)]);
  const firstEvent = await first.enqueue('saa-c03', attempt(['A']));
  const secondEvent = await second.enqueue('saa-c03', attempt(['A']));

  expect(secondEvent.eventId).not.toBe(firstEvent.eventId);
  const restored = new MemberRetryQueue(owner, local);
  await restored.setServerGeneration(4);
  expect([...restored.pending.values()].map((event) => event.eventId).sort()).toEqual(
    [firstEvent.eventId, secondEvent.eventId].sort(),
  );
});
