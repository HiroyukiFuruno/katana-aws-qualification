import { expect, test } from 'bun:test';
import type { ExamDraft } from '../src/exam';
import { ExamSubmissionAttempt } from '../src/examSubmissionAttempt';
import { ExamFinalizationCache } from '../src/progress/examFinalization';
import { examQuestion } from './progress-store-fixture';

test('a finalize retry uses the saved response revision and immutable event payload', () => {
  const beforeSave: ExamDraft = {
    deadline: 1_000,
    id: '00000000-0000-0000-0000-000000000001',
    order: ['["q",1]'],
    position: 0,
    responses: { '["q",1]': { durationMs: 10, flagged: false, selected: ['a'], selectedAt: 800 } },
    revision: 4,
  };
  const saved = {
    ...beforeSave,
    responses: { '["q",1]': { durationMs: 25, flagged: false, selected: ['a'], selectedAt: 800 } },
    revision: 5,
  };
  const attempt = new ExamSubmissionAttempt();
  const cache = new ExamFinalizationCache();
  const first = cache.getOrCreate([], 'saa-c03', attempt.prepare(saved), [examQuestion], 900);
  const retryDraft = attempt.retry(saved);
  const retry = cache.getOrCreate([], 'saa-c03', retryDraft ?? beforeSave, [examQuestion], 1_000);
  expect(retryDraft).toBe(saved);
  expect(retryDraft?.revision).toBe(5);
  expect(retry).toBe(first);
  expect(retry.events[0]?.event_id).toBe(first.events[0]?.event_id);
  expect(retry.events[0]?.duration_ms).toBe(25);
  expect(attempt.retry({ ...saved, revision: 6 })).toBeUndefined();
});

test('guest retries reuse an unchanged draft but rebuild changed answers', () => {
  const draft: ExamDraft = {
    deadline: 1_000,
    id: '00000000-0000-0000-0000-000000000001',
    order: ['["q",1]'],
    position: 0,
    responses: { '["q",1]': { durationMs: 25, flagged: false, selected: ['a'], selectedAt: 800 } },
  };
  const attempt = new ExamSubmissionAttempt();
  const cache = new ExamFinalizationCache();
  const first = cache.getOrCreate([], 'saa-c03', attempt.prepareGuest(draft), [examQuestion], 900);
  const unchanged = attempt.retryGuest(draft);
  expect(unchanged).toBe(draft);
  expect(cache.getOrCreate([], 'saa-c03', unchanged ?? draft, [examQuestion], 1_000)).toBe(first);
  const changed = {
    ...draft,
    responses: { '["q",1]': { ...draft.responses['["q",1]'], selected: ['b'] } },
  };
  expect(attempt.retryGuest(changed)).toBeUndefined();
  const rebuilt = new ExamFinalizationCache().getOrCreate([], 'saa-c03', changed, [examQuestion], 1_000);
  expect(rebuilt.events[0]?.selected).toEqual(['b']);
  expect(rebuilt.events[0]?.event_id).not.toBe(first.events[0]?.event_id);
});
