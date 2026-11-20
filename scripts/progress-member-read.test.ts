import { expect, test } from 'bun:test';
import { createProgressStore, type ProgressRpcClient } from '../src/progress';
import { memberEventRow } from './progress-store-fixture';

test('member read rejects a same-count replacement during pagination and keeps the prior snapshot', async () => {
  let generation = 1;
  let replaceDuringRead = false;
  const client: ProgressRpcClient = {
    async rpc(name) {
      if (name === 'initialize_learning_state') return generation;
      if (name === 'load_roadmap_profile_snapshot') return [];
      throw new Error(`unexpected rpc: ${name}`);
    },
    async select(table) {
      if (table !== 'learning_events') return [];
      if (replaceDuringRead) generation = 2;
      return [memberEventRow(replaceDuringRead ? 'event-2' : 'event-1')];
    },
  };
  const store = createProgressStore({
    client,
    isCurrent: () => true,
    owner: { kind: 'member', generation: 1, userId: 'member-a' },
    storage: { getItem: () => null, removeItem: () => {}, setItem: () => {} },
  });
  await store.initialize();
  expect(store.getSnapshot().attempts).toHaveLength(1);
  replaceDuringRead = true;
  await store.initialize();
  expect(store.getSnapshot().error).toBe('load');
  expect(store.getSnapshot().attempts).toHaveLength(1);
  expect(store.getSnapshot().attempts[0].eventId).toBe('event-1');
});
