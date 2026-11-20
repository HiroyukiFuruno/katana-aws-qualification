import { expect, test } from 'bun:test';
import { statsFor } from '../src/attempts';
import { examQuestion, memberAttempt } from './progress-store-fixture';

const question = {
  ...examQuestion,
  id: memberAttempt.questionId,
  revision: memberAttempt.questionRevision,
};

test('a late imported review does not replace a more recent answer', () => {
  const recent = { ...memberAttempt, mode: 'review' as const, answeredAt: '2026-11-20T00:00:00Z' };
  const old = { ...recent, answeredAt: '2026-11-19T00:00:00Z', isCorrect: false };
  expect(statsFor([recent, old], question)).toEqual({ total: 2, wrong: 1, lastReview: recent });
});

test('review recency compares instants and ignores a later study attempt', () => {
  const recent = { ...memberAttempt, mode: 'review' as const, answeredAt: '2026-11-20T01:00:00Z' };
  const earlier = { ...recent, answeredAt: '2026-11-20T09:00:00+09:00' };
  const study = { ...memberAttempt, answeredAt: '2026-11-21T00:00:00Z' };
  expect(statsFor([recent, earlier, study], question).lastReview).toBe(recent);
});
