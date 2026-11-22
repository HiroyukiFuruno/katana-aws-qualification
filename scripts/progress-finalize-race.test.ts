import { expect, test } from 'bun:test';
import type { Attempt } from '../src/attempts';
import type { ProgressRpcClient } from '../src/progress';
import type { ExamFinalizationEvent } from '../src/progress/examFinalization';
import { finalizationEventRow, memberEventRow, memberStore } from './progress-store-fixture';

const examId = '00000000-0000-0000-0000-000000000001';
const study: Attempt = {
  answeredAt: '2026-11-20T00:00:00.000Z',
  attemptNumber: 1,
  category: 'storage',
  correct: ['A'],
  durationMs: 10,
  isCorrect: true,
  mode: 'study',
  priorIncorrectCount: 0,
  questionId: 'study-q',
  questionRevision: 1,
  reviewCorrect: null,
  reward: 1,
  schemaVersion: 1,
  selected: ['A'],
  sourceVersion: 'v1',
};
const finalized: ExamFinalizationEvent = {
  answered_at: study.answeredAt,
  attempt_number: 1,
  category: study.category,
  certification_id: 'saa-c03',
  correct: study.correct,
  duration_ms: study.durationMs,
  event_id: '00000000-0000-0000-0000-000000000002',
  exam_id: examId,
  is_correct: true,
  mode: 'exam',
  prior_incorrect_count: 0,
  question_id: 'exam-q',
  question_revision: 1,
  review_correct: null,
  reward: 1,
  schema_version: 1,
  selected: study.selected,
  source_version: 'v1',
};
test('an append begun before finalization retains the finalized events', async () => {
  let hasExam = false;
  let hasStudy = false;
  let releaseAppend: (() => void) | undefined;
  let appendStarted: (() => void) | undefined;
  const client: ProgressRpcClient = {
    async rpc(name) {
      if (name === 'initialize_learning_state') return 1;
      if (name === 'load_roadmap_profile_snapshot_v2') return [];
      if (name === 'finalize_exam_session') {
        hasExam = true;
        return 'finalized';
      }
      if (name === 'append_learning_event') {
        appendStarted?.();
        await new Promise<void>((resolve) => {
          releaseAppend = resolve;
        });
        hasStudy = true;
        return 'study-event';
      }
      throw new Error(`unexpected rpc: ${name}`);
    },
    async select(table) {
      if (table !== 'learning_events') return [];
      return [
        ...(hasExam ? [finalizationEventRow(finalized)] : []),
        ...(hasStudy ? [memberEventRow('study-event', study)] : []),
      ];
    },
  };
  const store = memberStore(client);
  await store.initialize();
  const appendReady = new Promise<void>((resolve) => {
    appendStarted = resolve;
  });
  const append = store.appendAttempt('saa-c03', study);
  await appendReady;
  await store.finalizeExam(
    {
      id: examId,
      deadline: Date.now() + 60_000,
      order: ['["exam-q",1]'],
      position: 0,
      responses: {},
      revision: 1,
    },
    [finalized],
  );
  releaseAppend?.();
  await append;
  expect(store.getSnapshot().attempts.map((attempt) => attempt.questionId)).toEqual([
    'exam-q',
    'study-q',
  ]);
});
