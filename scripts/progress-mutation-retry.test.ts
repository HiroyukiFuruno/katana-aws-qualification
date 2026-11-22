import { expect, test } from 'bun:test';
import { createProgressStore, type ProgressRpcClient } from '../src/progress';
import { memberAttempt, memberEventRow, memoryStorage } from './progress-store-fixture';

function memberStore(client: ProgressRpcClient) {
  return createProgressStore({
    client,
    isCurrent: () => true,
    owner: { kind: 'member', generation: 1, userId: 'member-a' },
    storage: memoryStorage(),
  });
}

test('retry reloads the committed reset after its response is lost', async () => {
  let generation = 0;
  let events = [memberEventRow('before-reset')];
  const writeGenerations: unknown[] = [];
  const client: ProgressRpcClient = {
    async rpc(name, args) {
      if (name === 'initialize_learning_state') return generation;
      if (name === 'load_roadmap_profile_snapshot_v2') return [];
      if (name === 'reset_my_learning_data') {
        generation = 1;
        events = [];
        throw new Error('response lost after reset');
      }
      if (name === 'append_learning_event') {
        writeGenerations.push(args.p_expected_generation);
        return 'after-reset';
      }
    },
    async select(table) {
      return table === 'learning_events' ? events : [];
    },
  };
  const store = memberStore(client);
  await store.initialize();
  await expect(store.reset()).rejects.toThrow('response lost after reset');
  expect(store.getSnapshot().error).toBe('reset');

  await store.retryPending();
  expect(store.getSnapshot().attempts).toEqual([]);
  await store.appendAttempt('saa-c03', memberAttempt);
  expect(writeGenerations).toEqual([1]);
});

test('retry reloads a committed profile before the next profile save', async () => {
  const generation = 0;
  let profile = { answers: {} as Record<string, number>, earned: [] as string[], revision: 0 };
  const expectedRevisions: unknown[] = [];
  let responseLost = true;
  const client: ProgressRpcClient = {
    async rpc(name, args) {
      if (name === 'initialize_learning_state') return generation;
      if (name === 'load_roadmap_profile_snapshot_v2') return [profile];
      if (name === 'replace_roadmap_profile_v2') {
        expectedRevisions.push(args.p_expected_revision);
        profile = {
          answers: args.p_answers as Record<string, number>,
          earned: args.p_earned as string[],
          revision: profile.revision + 1,
        };
        if (responseLost) {
          responseLost = false;
          throw new Error('response lost after profile save');
        }
        return profile.revision;
      }
    },
    async select() {
      return [];
    },
  };
  const store = memberStore(client);
  await store.initialize();
  await expect(store.replaceProfile({ answers: { first: 1 }, earned: ['saa-c03'] })).rejects.toThrow(
    'response lost after profile save',
  );
  expect(store.getSnapshot().error).toBe('save');

  await store.retryPending();
  expect(store.getSnapshot().profileRevision).toBe(1);
  expect(store.getSnapshot().profile).toEqual({
    answers: { first: 1 },
    earned: ['saa-c03'],
    optionOrders: {},
    order: [],
  });
  await store.replaceProfile({ answers: { second: 2 }, earned: ['dva-c03'] });
  expect(expectedRevisions).toEqual([0, 1]);
  expect(store.getSnapshot().profileRevision).toBe(2);
});
