import { expect, test } from 'bun:test';
import { getActiveProgressStore } from '../src/history';
import { ProgressCoordinator } from '../src/progress/ProgressCoordinator';
import {
  account,
  api,
  authFixture,
  configuration,
  storage,
  waitForOwner,
} from './progress-coordinator-transition-fixture';

test('an old retry failure cannot republish the previous account', async () => {
  const restoreFetch = api();
  const source = authFixture();
  const stopAuth = source.authStore.start();
  const coordinator = new ProgressCoordinator(source.authStore, configuration, storage());
  const stop = coordinator.start();
  let rejectRetry: (error: Error) => void = () => {};
  try {
    source.emit(account('member-a'));
    await waitForOwner(coordinator, 'member-a');
    const oldStore = coordinator.getSnapshot().store;
    if (!oldStore) throw new Error('Member A store is required.');
    oldStore.retryPending = () =>
      new Promise<void>((_resolve, reject) => {
        rejectRetry = reject;
      });
    const retry = coordinator.retry();
    source.emit(account('member-b'));
    await waitForOwner(coordinator, 'member-b');
    const currentStore = coordinator.getSnapshot().store;
    rejectRetry(new Error('Old request failed'));
    await retry;
    expect(coordinator.getSnapshot()).toEqual({ status: 'ready', store: currentStore });
    expect(currentStore).not.toBe(oldStore);
    expect(getActiveProgressStore()).toBe(currentStore);
  } finally {
    rejectRetry(new Error('Test finished'));
    stop();
    stopAuth();
    restoreFetch();
  }
});
