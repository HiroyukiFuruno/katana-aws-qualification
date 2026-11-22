import { expect, test } from 'bun:test';
import { createProgressStore, type ProgressRpcClient } from '../src/progress';
import {
  memberAttempt,
  memberEventRow,
  memberStore,
  retryGenerationConflictClient,
} from './progress-store-fixture';

test('a failed member write rejects and retries the same logical answer with its original UUID', async () => {
  const eventIds: string[] = [];
  let fail = true;
  const client: ProgressRpcClient = {
    async rpc(name, args) {
      if (name === 'initialize_learning_state') return 1;
      if (name !== 'append_learning_event') return;
      eventIds.push((args.p_event as { event_id: string }).event_id);
      if (fail) throw new Error('response lost');
    },
    async select() {
      return [memberEventRow('event-id')];
    },
  };
  const store = memberStore(client);
  await store.initialize();
  await expect(store.appendAttempt('saa-c03', memberAttempt)).rejects.toThrow('response lost');
  expect(store.getSnapshot().error).toBe('save');
  fail = false;
  await store.appendAttempt('saa-c03', { ...memberAttempt, answeredAt: '2026-11-20T00:01:00.000Z' });
  expect(eventIds).toHaveLength(2);
  expect(eventIds[0]).toBe(eventIds[1]);
  expect(store.getSnapshot().attempts).toMatchObject([memberAttempt]);
  expect(store.getSnapshot().error).toBeUndefined();
});

test('retryPending flushes pending writes before reloading the member snapshot', async () => {
  let fail = true;
  let eventWrites = 0;
  const learningEventReads: Record<string, string>[] = [];
  const client: ProgressRpcClient = {
    async rpc(name) {
      if (name !== 'append_learning_event') return 1;
      eventWrites++;
      if (fail) throw new Error('offline');
      return 'event-id';
    },
    async select(table, filters = {}) {
      if (table === 'learning_events') learningEventReads.push(filters);
      return [];
    },
  };
  const store = memberStore(client);
  await store.initialize();
  await expect(store.appendAttempt('saa-c03', memberAttempt)).rejects.toThrow('offline');
  fail = false;
  await store.retryPending();
  expect(eventWrites).toBe(2);
  expect(learningEventReads).toEqual([{}, { question_id: 'eq.q-1', question_revision: 'eq.1' }, {}]);
});

test('a generation conflict during retry drops the old event before a new answer is saved', async () => {
  let generation = 1;
  let staleCalls = 0;
  const writes: { eventId: string; generation: number }[] = [];
  const accepted: string[] = [];
  const client = retryGenerationConflictClient(
    () => generation,
    writes,
    (eventId) => accepted.push(eventId),
  );
  const store = createProgressStore({
    client,
    isCurrent: () => true,
    onStaleGeneration: () => {
      staleCalls++;
    },
    owner: { kind: 'member', generation: 1, userId: 'member-a' },
    storage: { getItem: () => null, removeItem: () => {}, setItem: () => {} },
  });
  await store.initialize();
  await expect(store.appendAttempt('saa-c03', memberAttempt)).rejects.toThrow('offline');
  generation = 2;
  await expect(store.retryPending()).rejects.toThrow('reset');
  expect(staleCalls).toBe(1);
  await store.appendAttempt('saa-c03', { ...memberAttempt, answeredAt: '2026-11-20T00:02:00.000Z' });
  expect(writes.map((write) => write.generation)).toEqual([1, 1, 2]);
  expect(writes[0].eventId).not.toBe(writes[2].eventId);
  expect(accepted).toEqual([writes[2].eventId]);
});

test('retry preserves its save error when the generation refresh also fails', async () => {
  let rejectGenerationRefresh = false;
  let writes = 0;
  const client: ProgressRpcClient = {
    async rpc(name) {
      if (name === 'initialize_learning_state') {
        if (rejectGenerationRefresh) throw new Error('generation unavailable');
        return 1;
      }
      if (name === 'load_roadmap_profile_snapshot_v2') return [];
      if (name === 'append_learning_event') {
        writes++;
        if (writes === 1) throw new Error('offline');
        rejectGenerationRefresh = true;
        throw Object.assign(new Error('reset'), { code: 'PT409' });
      }
    },
    async select() {
      return [];
    },
  };
  const store = memberStore(client);
  await store.initialize();
  await expect(store.appendAttempt('saa-c03', memberAttempt)).rejects.toThrow('offline');
  await expect(store.retryPending()).rejects.toThrow('reset');
  expect(store.getSnapshot().error).toBe('save');
});
