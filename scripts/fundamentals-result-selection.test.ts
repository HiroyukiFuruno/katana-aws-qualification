import { expect, test } from 'bun:test';
import { submittedSession } from '../src/fundamentals/learner/lesson-result-helpers';
import { passedLessonSnapshot } from './fundamentals-state-fixture';

test('the latest result compares microseconds and an explicit result remains fixed', () => {
  const original = passedLessonSnapshot().sessions[0];
  if (!original) throw new Error('Missing submitted fixture.');
  const earlier = { ...original, submittedAt: '2026-11-20T10:00:00.123001Z' };
  const later = {
    ...original,
    sessionId: '00000000-0000-0000-0000-000000000002',
    submittedAt: '2026-11-20T11:00:00.123999+01:00',
  };
  expect(submittedSession([later, earlier])?.sessionId).toBe(later.sessionId);
  expect(submittedSession([later, earlier], earlier.sessionId)?.submittedAt).toBe(earlier.submittedAt);
});
