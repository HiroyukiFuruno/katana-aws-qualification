import { expect, test } from 'bun:test';
import type { Attempt } from '../src/attempts';
import {
  createGuestProgressRepository,
  createProgressStore,
  setGuestProgressConsent,
} from '../src/progress';
import { memoryStorage } from './progress-store-fixture';

const examKey = 'katana.certification-exam.v1.saa-c03';
const historyKey = 'saa-study.attempts.v1';
const attempt: Attempt = {
  answeredAt: '2026-11-20T00:00:00.000Z',
  attemptNumber: 1,
  category: 'storage',
  correct: ['A'],
  durationMs: 10,
  isCorrect: true,
  mode: 'study',
  priorIncorrectCount: 0,
  questionId: 'old',
  questionRevision: 1,
  reviewCorrect: null,
  reward: 1,
  schemaVersion: 1,
  selected: ['A'],
  sourceVersion: 'v1',
};
function draft(position: number) {
  return {
    deadline: 1_800_000_000_000,
    id: '00000000-0000-0000-0000-000000000001',
    order: ['["exam-q",1]'],
    position,
    responses: { '["exam-q",1]': { durationMs: 10, flagged: position === 1, selected: ['A'] } },
  };
}
test('a granted guest can replace a valid draft while retaining a corrupt persisted draft', () => {
  const local = memoryStorage();
  setGuestProgressConsent(local, true);
  const repository = createGuestProgressRepository({ kind: 'guest', generation: 1 }, local, {
    isCurrent: () => true,
  });
  expect(repository.write(examKey, JSON.stringify(draft(0)))).toBe('saved');
  expect(repository.write(examKey, JSON.stringify(draft(1)))).toBe('saved');
  expect(JSON.parse(local.getItem(examKey) ?? '')).toEqual(draft(1));
  local.setItem(examKey, '{bad json');
  expect(repository.write(examKey, JSON.stringify(draft(0)))).toBe('failed');
  expect(local.getItem(examKey)).toBe('{bad json');
});

test('guest drafts stay in memory without consent and resume only after consent', async () => {
  const local = memoryStorage();
  const owner = { kind: 'guest' as const, generation: 1 };
  const first = createProgressStore({ isCurrent: () => true, owner, storage: local });
  await first.initialize();
  await first.saveGuestExam(examKey, draft(0));
  expect(first.readGuestExam(examKey)).toEqual(draft(0));
  expect(local.getItem(examKey)).toBeNull();
  const noConsentReload = createProgressStore({ isCurrent: () => true, owner, storage: local });
  await noConsentReload.initialize();
  expect(noConsentReload.readGuestExam(examKey)).toBeUndefined();
  setGuestProgressConsent(local, true);
  await first.saveGuestExam(examKey, draft(1));
  const consentReload = createProgressStore({ isCurrent: () => true, owner, storage: local });
  await consentReload.initialize();
  expect(consentReload.readGuestExam(examKey)).toEqual(draft(1));
});

test('guest finalization updates the canonical history once before normal learning', async () => {
  const local = memoryStorage();
  setGuestProgressConsent(local, true);
  const store = createProgressStore({
    isCurrent: () => true,
    owner: { kind: 'guest', generation: 1 },
    storage: local,
  });
  const examAttempt = { ...attempt, examId: 'exam-1', mode: 'exam' as const };
  await store.initialize();
  await store.finalizeGuestExam('exam-1', [examAttempt]);
  await store.finalizeGuestExam('exam-1', [examAttempt]);
  await store.appendAttempt('saa-c03', { ...attempt, questionId: 'after-exam' });
  expect(store.getSnapshot().attempts.map((item) => item.questionId)).toEqual(['old', 'after-exam']);
  expect(store.getSnapshot().attempts.filter((item) => item.examId === 'exam-1')).toHaveLength(1);
});

test('guest finalization retains an invalid history row instead of duplicating valid attempts', async () => {
  const local = memoryStorage();
  setGuestProgressConsent(local, true);
  local.setItem(historyKey, JSON.stringify([attempt, { broken: true }]));
  const store = createProgressStore({
    isCurrent: () => true,
    owner: { kind: 'guest', generation: 1 },
    storage: local,
  });
  await store.initialize();
  await expect(
    store.finalizeGuestExam('exam-1', [{ ...attempt, examId: 'exam-1', mode: 'exam' }]),
  ).rejects.toThrow();
  expect(JSON.parse(local.getItem(historyKey) ?? '')).toEqual([attempt, { broken: true }]);
});

test('guest reset removes persisted and in-memory exam drafts', async () => {
  const local = memoryStorage();
  setGuestProgressConsent(local, true);
  local.setItem('saa-study.incorrect.v1', '["old"]');
  const store = createProgressStore({
    isCurrent: () => true,
    owner: { kind: 'guest', generation: 1 },
    storage: local,
  });
  await store.initialize();
  await store.saveGuestExam(examKey, draft(0));
  await store.reset();
  expect(local.getItem(examKey)).toBeNull();
  expect(local.getItem('saa-study.incorrect.v1')).toBeNull();
  expect(store.readGuestExam(examKey)).toBeUndefined();
});
