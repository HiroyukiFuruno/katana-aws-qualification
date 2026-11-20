import { expect, test } from 'bun:test';
import { setGuestProgressConsent, createProgressStore } from '../src/progress';
import { memberAttempt, memoryStorage } from './progress-store-fixture';

test('guest append refreshes the UI from the merged disk snapshot after consent changes', async () => {
  const local = memoryStorage();
  local.setItem('katana.learning-progress-consent.v1', 'denied');
  local.setItem('saa-study.attempts.v1', JSON.stringify([{ ...memberAttempt, questionId: 'old' }]));
  const store = createProgressStore({
    isCurrent: () => true,
    owner: { kind: 'guest', generation: 1 },
    storage: local,
  });
  await store.initialize();
  await store.appendAttempt('saa-c03', { ...memberAttempt, questionId: 'a' });
  setGuestProgressConsent(local, true);
  await store.initialize();
  await store.appendAttempt('saa-c03', { ...memberAttempt, questionId: 'b' });
  await store.appendAttempt('saa-c03', { ...memberAttempt, questionId: 'c' });
  expect(store.getSnapshot().attempts.map((item) => item.questionId)).toEqual(['old', 'a', 'b', 'c']);
  expect(JSON.parse(local.getItem('saa-study.attempts.v1') ?? '')).toHaveLength(4);
});
