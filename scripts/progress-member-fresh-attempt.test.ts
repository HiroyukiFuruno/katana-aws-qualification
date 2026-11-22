import { expect, test } from 'bun:test';
import { saveAttempt, setActiveProgressStore } from '../src/history';
import { createProgressStore, type ProgressRpcClient } from '../src/progress';
import { memberAnswerQuestion, memoryStorage } from './progress-store-fixture';

const owner = { kind: 'member' as const, generation: 1, userId: 'member-a' };
const question = memberAnswerQuestion;

type EventRow = {
  answered_at: string;
  attempt_number: number;
  category: string;
  certification_id: string;
  correct: string[];
  duration_ms: number;
  event_id: string;
  is_correct: boolean;
  mode: 'study';
  prior_incorrect_count: number;
  question_id: string;
  question_revision: number;
  review_correct: null;
  reward: 0 | 1;
  schema_version: 1;
  selected: string[];
  source_version: string;
};

function server(): { client: ProgressRpcClient; events: EventRow[]; reads: Record<string, string>[] } {
  const events: EventRow[] = [];
  const reads: Record<string, string>[] = [];
  return {
    events,
    reads,
    client: {
      async rpc(name, args) {
        if (name === 'initialize_learning_state') return 1;
        if (name === 'load_roadmap_profile_snapshot_v2') return [];
        if (name !== 'append_learning_event') return;
        const event = args.p_event as EventRow;
        events.push(event);
        return event.event_id;
      },
      async select(_table, filters = {}) {
        reads.push(filters);
        return events.filter(
          (event) =>
            (!filters.question_id || filters.question_id === `eq.${event.question_id}`) &&
            (!filters.question_revision ||
              filters.question_revision === `eq.${event.question_revision}`),
        );
      },
    },
  };
}

function store(client: ProgressRpcClient) {
  return createProgressStore({ client, isCurrent: () => true, owner, storage: memoryStorage() });
}

test('two initialized member stores prepare the later answer from fresh server history', async () => {
  const shared = server();
  const first = store(shared.client);
  const second = store(shared.client);
  await Promise.all([first.initialize(), second.initialize()]);
  try {
    setActiveProgressStore(first);
    await saveAttempt(question, ['W'], 'study', 1, 'saa-c03', first);
    setActiveProgressStore(second);
    const saved = await saveAttempt(question, ['C'], 'study', 1, 'saa-c03', second);

    expect(saved.attempt).toMatchObject({ attemptNumber: 2, priorIncorrectCount: 1 });
    expect(second.getSnapshot().attempts).toHaveLength(2);
    expect(shared.events.at(-1)).toMatchObject({ attempt_number: 2, prior_incorrect_count: 1 });
    expect(shared.reads).toContainEqual({ question_id: 'eq.q-1', question_revision: 'eq.1' });
  } finally {
    setActiveProgressStore(undefined);
  }
});
