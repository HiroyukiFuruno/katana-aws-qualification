import { expect, test } from 'bun:test';
import { historyKey } from '../src/history';
import { createProgressStore, setGuestProgressConsent } from '../src/progress';
import { memberAttempt, memoryStorage } from './progress-store-fixture';

test('a failed granted history save restores provenance so retry adds one logical answer', async () => {
  const local = memoryStorage();
  setGuestProgressConsent(local, true);
  const base = { ...memberAttempt, questionId: 'same' };
  local.setItem(historyKey, JSON.stringify([base]));
  let quota = true;
  const storage = {
    ...local,
    setItem: (key: string, value: string) => {
      if (quota && key === historyKey) throw new Error('quota');
      local.setItem(key, value);
    },
  };
  const store = createProgressStore({
    isCurrent: () => true,
    owner: { generation: 1, kind: 'guest' as const },
    storage,
  });
  await store.initialize();
  await expect(
    store.appendAttempt('saa-c03', { ...base, answeredAt: '2026-11-20T00:01:00.000Z' }),
  ).rejects.toThrow();
  quota = false;
  await store.appendAttempt('saa-c03', { ...base, answeredAt: '2026-11-20T00:02:00.000Z' });
  expect(JSON.parse(local.getItem(historyKey) ?? '')).toMatchObject([
    { answeredAt: base.answeredAt },
    { answeredAt: '2026-11-20T00:02:00.000Z' },
  ]);
});

test('denied initialization keeps an in-memory history pending without an error', async () => {
  const local = memoryStorage();
  const store = createProgressStore({
    isCurrent: () => true,
    owner: { generation: 1, kind: 'guest' as const },
    storage: local,
  });
  await store.initialize();
  await store.appendAttempt('saa-c03', memberAttempt);
  await store.initialize();
  expect(store.getSnapshot()).toMatchObject({ attempts: [memberAttempt], state: 'ready' });
  expect(local.getItem(historyKey)).toBeNull();
});
