import { questionKey, type Question } from './questions';

export type Mode = 'study' | 'review';
export type Attempt = {
  schemaVersion: 1;
  questionId: string;
  questionRevision: number;
  category: string;
  sourceVersion: string;
  answeredAt: string;
  selected: string[];
  correct: string[];
  isCorrect: boolean;
  durationMs: number;
  attemptNumber: number;
  priorIncorrectCount: number;
  mode: Mode | 'exam';
  examId?: string;
  reviewCorrect: boolean | null;
  reward: 0 | 1;
};

export function statsFor(history: Attempt[], question: Question) {
  const attempts = history.filter(
    (a) => questionKey({ id: a.questionId, revision: a.questionRevision }) === questionKey(question),
  );
  return {
    total: attempts.length,
    wrong: attempts.filter((attempt) => !attempt.isCorrect).length,
    lastReview: attempts.findLast((attempt) => attempt.mode === 'review'),
  };
}

export function makeAttempt(
  history: Attempt[],
  question: Question,
  selected: string[],
  mode: Attempt['mode'],
  durationMs: number,
  answeredAt: string,
  examId?: string,
): Attempt {
  const stats = statsFor(history, question);
  const correct = question.correct;
  const isCorrect = correct.length === selected.length && correct.every((id) => selected.includes(id));
  return {
    schemaVersion: 1,
    questionId: question.id,
    questionRevision: question.revision,
    category: question.category,
    sourceVersion: question.version,
    answeredAt,
    selected,
    correct,
    isCorrect,
    durationMs,
    attemptNumber: stats.total + 1,
    priorIncorrectCount: stats.wrong,
    mode,
    reviewCorrect: mode === 'review' ? isCorrect : null,
    reward: isCorrect ? 1 : 0,
    ...(examId === undefined ? {} : { examId }),
  };
}
