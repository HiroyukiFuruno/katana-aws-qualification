import { expect, test } from 'bun:test';
import { createProgressStore } from '../src/progress';
import { memberAttempt, memoryStorage } from './progress-store-fixture';

test('only explicit exam invalidation reloads mounted exams and stale owners cannot notify', async () => {
  let current = true;
  const store = createProgressStore({
    isCurrent: () => current,
    owner: { kind: 'guest', generation: 1 },
    storage: memoryStorage(),
  });
  await store.initialize();
  expect(store.getSnapshot().examRefreshVersion).toBe(0);
  store.notifyExamSessionsChanged();
  expect(store.getSnapshot().examRefreshVersion).toBe(1);
  await store.appendAttempt('saa-c03', memberAttempt);
  await store.replaceProfile({ earned: ['saa-c03'], answers: {} });
  await store.initialize();
  expect(store.getSnapshot().examRefreshVersion).toBe(1);
  current = false;
  expect(() => store.notifyExamSessionsChanged()).toThrow();
  expect(store.getSnapshot().examRefreshVersion).toBe(1);
  await store.dispose();
});
