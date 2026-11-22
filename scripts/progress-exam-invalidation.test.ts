import { expect, test } from 'bun:test';
import { createProgressStore, setGuestProgressConsent } from '../src/progress';
import { memberAttempt, memoryStorage } from './progress-store-fixture';

test('exam invalidation follows explicit imports or consent changes and rejects stale owners', async () => {
  let current = true;
  const storage = memoryStorage();
  const store = createProgressStore({
    isCurrent: () => current,
    owner: { kind: 'guest', generation: 1 },
    storage,
  });
  await store.initialize();
  expect(store.getSnapshot().examRefreshVersion).toBe(0);
  store.notifyExamSessionsChanged();
  expect(store.getSnapshot().examRefreshVersion).toBe(1);
  await store.appendAttempt('saa-c03', memberAttempt);
  await store.replaceProfile({ earned: ['saa-c03'], answers: {}, optionOrders: {}, order: [] });
  await store.initialize();
  expect(store.getSnapshot().examRefreshVersion).toBe(1);
  setGuestProgressConsent(storage, true);
  await store.retryPending();
  expect(store.getSnapshot().examRefreshVersion).toBe(2);
  await store.replaceProfile({ earned: [], answers: {}, optionOrders: {}, order: [] });
  expect(store.getSnapshot().examRefreshVersion).toBe(2);
  setGuestProgressConsent(storage, false);
  await store.retryPending();
  expect(store.getSnapshot().examRefreshVersion).toBe(3);
  current = false;
  expect(() => store.notifyExamSessionsChanged()).toThrow();
  expect(store.getSnapshot().examRefreshVersion).toBe(3);
  await store.dispose();
});
