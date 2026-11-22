import { expect, test } from 'bun:test';
import { createProgressStore, type ProgressRpcClient } from '../src/progress';
import { MemberRetryQueue } from '../src/progress/retryQueue';
import { memberAttempt, memoryStorage } from './progress-store-fixture';

test('reset drops old generation events but keeps an event written by another tab after reset', async () => {
  const storage = memoryStorage();
  const owner = { kind: 'member' as const, generation: 1, userId: 'member-a' };
  const oldQueue = new MemberRetryQueue(owner, storage);
  await oldQueue.setServerGeneration(1);
  await oldQueue.enqueue('saa-c03', memberAttempt);
  let generation = 1;
  let resetComplete!: () => void;
  let replyReset!: () => void;
  const resetFinished = new Promise<void>((resolve) => {
    resetComplete = resolve;
  });
  const resetReply = new Promise<void>((resolve) => {
    replyReset = resolve;
  });
  const accepted: string[] = [];
  const client: ProgressRpcClient = {
    async rpc(name, args) {
      if (name === 'initialize_learning_state') return generation;
      if (name === 'load_roadmap_profile_snapshot_v2') return [];
      if (name === 'reset_my_learning_data') {
        generation = 2;
        resetComplete();
        await resetReply;
        return generation;
      }
      if (name !== 'append_learning_event') return;
      const event = args.p_event as { event_id: string };
      accepted.push(event.event_id);
      return event.event_id;
    },
    async select() {
      return [];
    },
  };
  const store = createProgressStore({ client, isCurrent: () => true, owner, storage });
  await store.initialize();
  const reset = store.reset();
  await resetFinished;
  const currentQueue = new MemberRetryQueue(owner, storage);
  await currentQueue.setServerGeneration(2);
  const current = await currentQueue.enqueue('saa-c03', {
    ...memberAttempt,
    answeredAt: '2026-11-20T00:02:00.000Z',
    questionId: 'q-2',
  });
  replyReset();
  await reset;
  await store.retryPending();

  expect(accepted).toEqual([current.eventId]);
});
