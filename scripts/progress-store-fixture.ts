import type { Attempt } from '../src/attempts';
import { createProgressStore, type ProgressRpcClient } from '../src/progress';
import type { Question } from '../src/questions';

const identifying = {
  category: 'storage',
  questionId: 'q-1',
  questionRevision: 1,
  schemaVersion: 1,
  sourceVersion: '2026-11',
} as const;
const outcome = {
  answeredAt: '2026-11-20T00:00:00.000Z',
  attemptNumber: 1,
  correct: ['a'],
  durationMs: 100,
  isCorrect: true,
  mode: 'study',
  priorIncorrectCount: 0,
  reviewCorrect: null,
  reward: 1,
  selected: ['a'],
} as const;

export const memberAttempt: Attempt = { ...identifying, ...outcome };

export const examQuestion: Question = {
  category: 'storage',
  choices: [{ explanation: 'Correct', id: 'a', text: 'A' }],
  correct: ['a'],
  id: 'q',
  prompt: 'Prompt',
  revision: 1,
  source: { label: 'AWS', url: 'https://docs.aws.amazon.com/' },
  title: 'Title',
  version: '2026-11',
};

export function memberEventRow(eventId: string) {
  return {
    answer_format: undefined,
    answered_at: memberAttempt.answeredAt,
    attempt_number: memberAttempt.attemptNumber,
    category: memberAttempt.category,
    certification_id: 'saa-c03',
    correct: memberAttempt.correct,
    duration_ms: memberAttempt.durationMs,
    event_id: eventId,
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
  };
}

export function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => void values.delete(key),
    setItem: (key: string, value: string) => void values.set(key, value),
  };
}

export type GenerationWrite = { eventId: string; generation: number };

export function retryGenerationConflictClient(
  getGeneration: () => number,
  writes: GenerationWrite[],
  onAccepted: (eventId: string) => void = () => {},
): ProgressRpcClient {
  return {
    async rpc(name, args) {
      if (name === 'initialize_learning_state') return getGeneration();
      if (name === 'load_roadmap_profile_snapshot') return [];
      if (name !== 'append_learning_event') return;
      const event = args.p_event as { event_id: string };
      writes.push({ eventId: event.event_id, generation: args.p_expected_generation as number });
      if (writes.length === 1) throw new Error('offline');
      if (writes.length === 2) throw Object.assign(new Error('reset'), { code: 'PT409' });
      onAccepted(event.event_id);
      return event.event_id;
    },
    async select() {
      return [];
    },
  };
}

export function memberStore(client: ProgressRpcClient) {
  return createProgressStore({
    client,
    isCurrent: () => true,
    owner: { kind: 'member', generation: 1, userId: 'member-a' },
    storage: { getItem: () => null, removeItem: () => {}, setItem: () => {} },
  });
}
