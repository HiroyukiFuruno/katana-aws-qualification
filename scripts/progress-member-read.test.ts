import { expect, test } from 'bun:test';
import { createProgressStore, type ProgressRpcClient } from '../src/progress';
import { memberAttempt } from './progress-store-fixture';

test('member read rejects a same-count replacement during pagination and keeps the prior snapshot', async () => {
  let generation = 1;
  let replaceDuringRead = false;
  const client: ProgressRpcClient = {
    async rpc(name) {
      if (name === 'initialize_learning_state') return generation;
      if (name === 'load_roadmap_profile_snapshot') return [];
      throw new Error(`unexpected rpc: ${name}`);
    },
    async select(table) {
      if (table !== 'learning_events') return [];
      if (replaceDuringRead) generation = 2;
      return [
        {
          answer_format: undefined,
          answered_at: memberAttempt.answeredAt,
          attempt_number: memberAttempt.attemptNumber,
          category: memberAttempt.category,
          certification_id: 'saa-c03',
          correct: memberAttempt.correct,
          duration_ms: memberAttempt.durationMs,
          event_id: replaceDuringRead ? 'event-2' : 'event-1',
          is_correct: memberAttempt.isCorrect,
          mode: memberAttempt.mode,
          prior_incorrect_count: memberAttempt.priorIncorrectCount,
          question_id: memberAttempt.questionId,
          question_revision: memberAttempt.questionRevision,
          review_correct: memberAttempt.reviewCorrect,
          reward: memberAttempt.reward,
          schema_version: memberAttempt.schemaVersion,
          selected: memberAttempt.selected,
          source_version: memberAttempt.sourceVersion,
        },
      ];
    },
  };
  const store = createProgressStore({
    client,
    isCurrent: () => true,
    owner: { kind: 'member', generation: 1, userId: 'member-a' },
    storage: { getItem: () => null, removeItem: () => {}, setItem: () => {} },
  });
  await store.initialize();
  expect(store.getSnapshot().attempts).toHaveLength(1);
  replaceDuringRead = true;
  await store.initialize();
  expect(store.getSnapshot().error).toBe('load');
  expect(store.getSnapshot().attempts).toHaveLength(1);
  expect(store.getSnapshot().attempts[0].eventId).toBe('event-1');
});
