import { expect, test } from 'bun:test';
import { ProgressCoordinator } from '../src/progress/ProgressCoordinator';
import { retryStorageKey } from '../src/progress/retryOutboxStorage';
import { MemberRetryQueue } from '../src/progress/retryQueue';
import {
  account,
  api,
  authFixture,
  configuration,
  storage,
  waitForOwner,
} from './progress-coordinator-transition-fixture';
import { memberAttempt } from './progress-store-fixture';
import { waitForGuest } from './progress-test-helpers';

for (const transition of ['guest', 'member-b'] as const) {
  test(`switching to ${transition} preserves the original owner's pending event`, async () => {
    const restoreFetch = api();
    const installedFetch = globalThis.fetch;
    let requests = 0;
    globalThis.fetch = async (...args) => {
      requests++;
      return installedFetch(...args);
    };
    const source = authFixture();
    const local = storage();
    const stopAuth = source.authStore.start();
    const coordinator = new ProgressCoordinator(source.authStore, configuration, local);
    const stop = coordinator.start();
    try {
      source.emit(account('member-a'));
      await waitForOwner(coordinator, 'member-a');
      const oldStore = coordinator.getSnapshot().store;
      const owner = oldStore?.getSnapshot().owner;
      if (owner?.kind !== 'member') throw new Error('Missing member fixture');
      const queue = new MemberRetryQueue(owner, local);
      await queue.setServerGeneration(1);
      const pending = await queue.enqueue('saa-c03', memberAttempt);
      const key = retryStorageKey(owner);
      const original = local.getItem(key);
      expect(original).not.toBeNull();
      source.emit(transition === 'guest' ? null : account(transition));
      if (transition === 'guest') await waitForGuest(coordinator);
      else await waitForOwner(coordinator, transition);
      expect(local.getItem(key)).toBe(original);
      const requestsBeforeRetry = requests;
      await oldStore?.retryPending();
      expect(requests).toBe(requestsBeforeRetry);
      expect(local.getItem(key)).toBe(original);
      source.emit(account('member-a'));
      await waitForOwner(coordinator, 'member-a');
      expect(local.getItem(key)).toBe(original);
      const restored = new MemberRetryQueue(owner, local);
      await restored.setServerGeneration(1);
      expect([...restored.pending.values()]).toEqual([pending]);
      expect(local.getItem('katana.learning-outbox.v1.member-b')).toBeNull();
    } finally {
      stop();
      stopAuth();
      restoreFetch();
    }
  });
}
