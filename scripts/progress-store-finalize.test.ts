import { expect, test } from 'bun:test';
import type { Attempt } from '../src/attempts';
import type { ProgressRpcClient } from '../src/progress';
import type { ExamFinalizationEvent } from '../src/progress/examFinalization';
import { finalizationEventRow, memberEventRow, memberStore } from './progress-store-fixture';

const studyAttempt: Attempt = {
  schemaVersion: 1,
  questionId: 'study-q',
  questionRevision: 1,
  category: 'storage',
  sourceVersion: 'v1',
  answeredAt: '2026-11-20T00:00:00.000Z',
  selected: ['A'],
  correct: ['A'],
  isCorrect: true,
  durationMs: 10,
  attemptNumber: 1,
  priorIncorrectCount: 0,
  mode: 'study',
  reviewCorrect: null,
  reward: 1,
};
const examId = '00000000-0000-0000-0000-000000000001';
const examEvent: ExamFinalizationEvent = {
  event_id: '00000000-0000-0000-0000-000000000002',
  certification_id: 'saa-c03',
  exam_id: examId,
  question_id: 'exam-q',
  question_revision: 1,
  source_version: 'v1',
  category: 'storage',
  mode: 'exam',
  answered_at: '2026-11-20T00:00:00.000Z',
  selected: ['A'],
  correct: ['A'],
  is_correct: true,
  duration_ms: 10,
  attempt_number: 1,
  prior_incorrect_count: 0,
  review_correct: null,
  reward: 1,
  schema_version: 1,
};

test('finalize refreshes the DB snapshot before a later study append', async () => {
  let hasExam = false;
  let hasStudy = false;
  const client: ProgressRpcClient = {
    async rpc(name) {
      if (name === 'initialize_learning_state') return 1;
      if (name === 'load_roadmap_profile_snapshot_v2') return [];
      if (name === 'finalize_exam_session') {
        hasExam = true;
        return 'finalized';
      }
      if (name === 'append_learning_event') {
        hasStudy = true;
        return 'study-event';
      }
      throw new Error(`unexpected rpc: ${name}`);
    },
    async select(table) {
      if (table !== 'learning_events') return [];
      return [
        ...(hasExam ? [finalizationEventRow(examEvent)] : []),
        ...(hasStudy ? [memberEventRow('study-event', studyAttempt)] : []),
      ];
    },
  };
  const store = memberStore(client);
  const snapshots: number[] = [];
  store.subscribe(() => snapshots.push(store.getSnapshot().attempts.length));
  await store.initialize();
  await store.finalizeExam(
    {
      id: examId,
      deadline: Date.now() + 60_000,
      order: ['["exam-q",1]'],
      position: 0,
      responses: {},
      revision: 1,
    },
    [examEvent],
  );
  await store.appendAttempt('saa-c03', studyAttempt);
  expect(store.getSnapshot().attempts.map((attempt) => attempt.questionId)).toEqual([
    'exam-q',
    'study-q',
  ]);
  expect(snapshots).toContain(1);
  expect(snapshots.at(-1)).toBe(2);
});
