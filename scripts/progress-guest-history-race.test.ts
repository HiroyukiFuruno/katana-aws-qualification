import { expect, test } from 'bun:test';
import { historyKey, withHistoryLock } from '../src/history';
import { createProgressStore, setGuestProgressConsent } from '../src/progress';
import { memberAttempt, memoryStorage } from './progress-store-fixture';

const base = { ...memberAttempt, questionId: 'base' };

async function stores() {
  const storage = memoryStorage();
  setGuestProgressConsent(storage, true);
  storage.setItem(historyKey, JSON.stringify([base]));
  const input = { isCurrent: () => true, owner: { generation: 1, kind: 'guest' as const }, storage };
  const first = createProgressStore(input);
  const second = createProgressStore(input);
  await Promise.all([first.initialize(), second.initialize()]);
  return { first, second, storage };
}

test('two stale guest stores append only their distinct suffixes', async () => {
  const { first, second, storage } = await stores();
  await Promise.all([
    withHistoryLock(() => first.appendAttempt('saa-c03', { ...base, questionId: 'a' })),
    withHistoryLock(() => second.appendAttempt('saa-c03', { ...base, questionId: 'b' })),
  ]);
  expect(JSON.parse(storage.getItem(historyKey) ?? '')).toMatchObject([
    { questionId: 'base' },
    { questionId: 'a' },
    { questionId: 'b' },
  ]);
});

test('two equal guest answers remain separate operations', async () => {
  const { first, second, storage } = await stores();
  const repeated = { ...base, questionId: 'same' };
  await Promise.all([
    withHistoryLock(() => first.appendAttempt('saa-c03', repeated)),
    withHistoryLock(() => second.appendAttempt('saa-c03', repeated)),
  ]);
  expect(JSON.parse(storage.getItem(historyKey) ?? '')).toEqual([base, repeated, repeated]);
});

test('a guest prepares the later answer from the history protected by the lock', async () => {
  const { first, second } = await stores();
  await withHistoryLock(() => first.appendAttempt('saa-c03', { ...base, questionId: 'first' }));
  const saved = await withHistoryLock(() =>
    second.appendAttempt('saa-c03', { ...base, questionId: 'later' }, (attempts) => ({
      ...base,
      attemptNumber: attempts.length + 1,
      questionId: 'later',
    })),
  );
  expect(saved.attemptNumber).toBe(3);
  expect(second.getSnapshot().attempts).toHaveLength(3);
});

test('two stale guest finalizations preserve only their new exam events', async () => {
  const { first, second, storage } = await stores();
  await Promise.all([
    withHistoryLock(() =>
      first.finalizeGuestExam('exam-a', [{ ...base, examId: 'exam-a', questionId: 'exam-a' }]),
    ),
    withHistoryLock(() =>
      second.finalizeGuestExam('exam-b', [{ ...base, examId: 'exam-b', questionId: 'exam-b' }]),
    ),
  ]);
  expect(JSON.parse(storage.getItem(historyKey) ?? '')).toMatchObject([
    { questionId: 'base' },
    { questionId: 'exam-a' },
    { questionId: 'exam-b' },
  ]);
});

test('a repeated submission from another stale guest store adopts the canonical exam history', async () => {
  const { first, second } = await stores();
  const events = [{ ...base, examId: 'same-exam', mode: 'exam' as const }];
  await withHistoryLock(() => first.finalizeGuestExam('same-exam', events));
  await withHistoryLock(() => second.finalizeGuestExam('same-exam', events));
  expect(second.getSnapshot().attempts).toEqual([base, ...events]);
});
