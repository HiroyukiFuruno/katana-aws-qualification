import type { Attempt } from '../src/attempts';
import { createProgressStore, type ProgressRpcClient } from '../src/progress';
import type { ExamFinalizationEvent } from '../src/progress/examFinalization';
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

export const memberAnswerQuestion: Question = {
  category: 'storage',
  choices: [
    { explanation: 'Wrong', id: 'W', text: 'Wrong' },
    { explanation: 'Correct', id: 'C', text: 'Correct' },
  ],
  correct: ['C'],
  id: 'q-1',
  prompt: 'Prompt',
  revision: 1,
  source: { label: 'AWS', url: 'https://docs.aws.amazon.com/' },
  title: 'Title',
  version: '2026-11',
};

type FixtureMemberEvent = Attempt & { certificationId?: string; examId?: string };

export function memberEventRow(eventId: string, event: FixtureMemberEvent = memberAttempt) {
  return {
    ...(event.format === undefined ? { answer_format: undefined } : { answer_format: event.format }),
    answered_at: event.answeredAt,
    attempt_number: event.attemptNumber,
    category: event.category,
    certification_id: event.certificationId ?? 'saa-c03',
    correct: event.correct,
    duration_ms: event.durationMs,
    event_id: eventId,
    ...(event.examId === undefined ? {} : { exam_id: event.examId }),
    is_correct: event.isCorrect,
    mode: event.mode,
    prior_incorrect_count: event.priorIncorrectCount,
    question_id: event.questionId,
    question_revision: event.questionRevision,
    review_correct: event.reviewCorrect,
    reward: event.reward,
    schema_version: event.schemaVersion,
    selected: event.selected,
    source_version: event.sourceVersion,
  };
}

export function finalizationEventRow(event: ExamFinalizationEvent) {
  return memberEventRow(event.event_id, {
    answeredAt: event.answered_at,
    attemptNumber: event.attempt_number,
    category: event.category,
    certificationId: event.certification_id,
    correct: event.correct,
    durationMs: event.duration_ms,
    examId: event.exam_id,
    ...(event.answer_format === undefined ? {} : { format: event.answer_format }),
    isCorrect: event.is_correct,
    mode: event.mode,
    priorIncorrectCount: event.prior_incorrect_count,
    questionId: event.question_id,
    questionRevision: event.question_revision,
    reviewCorrect: event.review_correct,
    reward: event.reward,
    schemaVersion: event.schema_version,
    selected: event.selected,
    sourceVersion: event.source_version,
  });
}

export function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() {
      return values.size;
    },
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
      if (name === 'load_roadmap_profile_snapshot_v2') return [];
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
    storage: memoryStorage(),
  });
}
