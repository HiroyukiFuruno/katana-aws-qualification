import { expect, test } from 'bun:test';
import { createProgressStore, type ProgressRpcClient } from '../src/progress';
import { memberAttempt, memberEventRow, memoryStorage } from './progress-store-fixture';

function deferred<T>() {
  let resolve!: (value: T) => void;
  return { promise: new Promise<T>((next) => (resolve = next)), resolve };
}

test('retry reload does not erase an answer acknowledged while its old read is pending', async () => {
  const reading = deferred<void>();
  const release = deferred<void>();
  const rows: ReturnType<typeof memberEventRow>[] = [];
  let delayRead = false;
  let offline = true;
  const client: ProgressRpcClient = {
    async rpc(name, args) {
      if (name === 'initialize_learning_state') return 1;
      if (name === 'load_roadmap_profile_snapshot_v2') return [];
      if (name !== 'append_learning_event') return;
      if (offline) {
        offline = false;
        throw new Error('offline');
      }
      const eventId = (args.p_event as { event_id: string }).event_id;
      rows.push(memberEventRow(eventId));
      return eventId;
    },
    async select(table, filters = {}) {
      const snapshot = [...rows];
      if (table === 'learning_events' && delayRead && !filters.question_id) {
        reading.resolve();
        await release.promise;
      }
      return snapshot;
    },
  };
  const store = createProgressStore({
    client,
    isCurrent: () => true,
    owner: { kind: 'member', generation: 1, userId: 'member-a' },
    storage: memoryStorage(),
  });
  await store.initialize();
  await expect(store.appendAttempt('saa-c03', memberAttempt)).rejects.toThrow('offline');

  delayRead = true;
  const retry = store.retryPending();
  await reading.promise;
  await store.appendAttempt('saa-c03', { ...memberAttempt, questionId: 'q-2' });
  release.resolve();
  await retry;

  expect(store.getSnapshot().attempts).toHaveLength(2);
});
