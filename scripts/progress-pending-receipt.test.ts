import { expect, test } from 'bun:test';
import type { Attempt } from '../src/attempts';
import { createProgressStore, type ProgressRpcClient } from '../src/progress';
import { MemberRetryQueue } from '../src/progress/retryQueue';
import { memberAttempt, memberStore, memoryStorage } from './progress-store-fixture';

function withAnswer(selected: string[], questionId = 'q-1'): Attempt {
  return {
    ...memberAttempt,
    correct: ['C'],
    isCorrect: selected[0] === 'C',
    questionId,
    reward: selected[0] === 'C' ? 1 : 0,
    selected,
  };
}

test('an acknowledged pending event remains in the snapshot when the new event fails', async () => {
  const writes: string[] = [];
  const client: ProgressRpcClient = {
    async rpc(name, args) {
      if (name === 'initialize_learning_state') return 1;
      if (name === 'load_roadmap_profile_snapshot') return [];
      if (name !== 'append_learning_event') return;
      const selected = (args.p_event as { selected: string[] }).selected[0] ?? '';
      writes.push(selected);
      if (writes.length === 1 || selected === 'C') throw new Error('offline');
      return 'event-id';
    },
    async select() {
      return [];
    },
  };
  const store = memberStore(client);
  await store.initialize();
  await expect(store.appendAttempt('saa-c03', withAnswer(['W']))).rejects.toThrow('offline');
  await expect(store.appendAttempt('saa-c03', withAnswer(['C']))).rejects.toThrow('offline');

  expect(writes).toEqual(['W', 'W', 'C']);
  expect(store.getSnapshot().attempts).toMatchObject([{ selected: ['W'] }]);
});

test('retryPending retains each event acknowledged before a later pending failure', async () => {
  const storage = memoryStorage();
  const owner = { kind: 'member' as const, generation: 1, userId: 'member-a' };
  const first = new MemberRetryQueue(owner, storage);
  const second = new MemberRetryQueue(owner, storage);
  await Promise.all([first.setServerGeneration(1), second.setServerGeneration(1)]);
  await first.enqueue('saa-c03', withAnswer(['W']));
  await second.enqueue('saa-c03', withAnswer(['W'], 'q-2'));

  let writes = 0;
  const client: ProgressRpcClient = {
    async rpc(name) {
      if (name === 'initialize_learning_state') return 1;
      if (name === 'load_roadmap_profile_snapshot') return [];
      if (name !== 'append_learning_event') return;
      writes++;
      if (writes === 2) throw new Error('offline');
      return 'event-id';
    },
    async select() {
      return [];
    },
  };
  const store = createProgressStore({ client, isCurrent: () => true, owner, storage });
  await store.initialize();
  await expect(store.retryPending()).rejects.toThrow('offline');

  expect(store.getSnapshot().attempts).toMatchObject([{ questionId: 'q-1', selected: ['W'] }]);
});
