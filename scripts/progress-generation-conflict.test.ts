import { expect, test } from 'bun:test';
import { createProgressStore } from '../src/progress';
import { MemberRetryQueue } from '../src/progress/retryQueue';
import { memberAttempt, memoryStorage, retryGenerationConflictClient } from './progress-store-fixture';

test('a generation conflict replaces old memory with the current owner outbox', async () => {
  const storage = memoryStorage();
  const owner = { kind: 'member' as const, generation: 1, userId: 'member-a' };
  let generation = 1;
  const writes: { eventId: string; generation: number }[] = [];
  const client = retryGenerationConflictClient(() => generation, writes);
  const store = createProgressStore({ client, isCurrent: () => true, owner, storage });
  await store.initialize();
  await expect(store.appendAttempt('saa-c03', memberAttempt)).rejects.toThrow('offline');
  const oldEventId = writes[0]?.eventId;

  generation = 2;
  const currentQueue = new MemberRetryQueue(owner, storage);
  await currentQueue.setServerGeneration(2);
  const current = await currentQueue.enqueue('saa-c03', {
    ...memberAttempt,
    answeredAt: '2026-11-20T00:02:00.000Z',
    questionId: 'q-2',
  });
  await expect(store.retryPending()).rejects.toThrow('reset');
  await store.retryPending();

  expect(writes.map((write) => write.eventId)).toEqual([oldEventId, oldEventId, current.eventId]);
  expect(writes.at(-1)).toMatchObject({ eventId: current.eventId, generation: 2 });
});
