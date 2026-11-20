import type { Page } from '@playwright/test';

export const attempt = JSON.stringify([
  {
    schemaVersion: 1,
    questionId: 'mock-secure-01',
    questionRevision: 2,
    category: 'セキュリティ',
    sourceVersion: 'SAA-C03 mock / 2026-11 v2',
    answeredAt: '2026-11-20T00:00:00.000Z',
    selected: ['A'],
    correct: ['A'],
    isCorrect: true,
    durationMs: 100,
    attemptNumber: 1,
    priorIncorrectCount: 0,
    mode: 'study',
    reviewCorrect: null,
    reward: 1,
  },
]);
export const keys = [
  'saa-study.attempts.v1',
  'katana.certification-profile.v1',
  'saa-study.incorrect.v1',
  'saa-study.exam.v1',
  'katana.certification-exam.v1.saa-c03',
];

export async function seedLegacyRecords(page: Page) {
  await page.evaluate(
    ({ keys, attempt }) => {
      localStorage.setItem('katana.learning-progress-consent.v1', 'granted');
      localStorage.setItem('saa-study.attempts.v1', attempt);
      localStorage.setItem(
        'katana.certification-profile.v1',
        JSON.stringify({ earned: ['saa-c03'], answers: {} }),
      );
      localStorage.setItem('saa-study.incorrect.v1', '["mock-secure-01"]');
      localStorage.setItem(
        'saa-study.exam.v1',
        JSON.stringify({ id: 'legacy', order: [], responses: {} }),
      );
      localStorage.setItem(
        'katana.certification-exam.v1.saa-c03',
        JSON.stringify({ id: 'current', order: [], responses: {} }),
      );
      for (const key of keys)
        if (localStorage.getItem(key) === null) throw new Error(`seed failed: ${key}`);
    },
    { keys, attempt },
  );
}
