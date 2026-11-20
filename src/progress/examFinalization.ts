import { type Attempt, makeAttempt } from '../attempts';
import type { ExamDraft } from '../exam';
import type { Question } from '../questions';

export type ExamFinalizationEvent = {
  answer_format?: Question['format'];
  answered_at: string;
  attempt_number: number;
  category: string;
  certification_id: string;
  correct: string[];
  duration_ms: number;
  event_id: string;
  exam_id: string;
  is_correct: boolean;
  mode: 'exam';
  prior_incorrect_count: number;
  question_id: string;
  question_revision: number;
  review_correct: null;
  reward: 0 | 1;
  schema_version: 1;
  selected: string[];
  source_version: string;
};

export type ExamFinalization = {
  attempts: Attempt[];
  events: ExamFinalizationEvent[];
};

function eventFromAttempt(
  attempt: Attempt,
  certificationId: string,
  eventId: string,
): ExamFinalizationEvent {
  return {
    answered_at: attempt.answeredAt,
    attempt_number: attempt.attemptNumber,
    category: attempt.category,
    certification_id: certificationId,
    correct: attempt.correct,
    duration_ms: attempt.durationMs,
    event_id: eventId,
    exam_id: attempt.examId ?? '',
    is_correct: attempt.isCorrect,
    mode: 'exam',
    prior_incorrect_count: attempt.priorIncorrectCount,
    question_id: attempt.questionId,
    question_revision: attempt.questionRevision,
    review_correct: null,
    reward: attempt.reward,
    schema_version: attempt.schemaVersion,
    selected: attempt.selected,
    source_version: attempt.sourceVersion,
    ...(attempt.format === undefined ? {} : { answer_format: attempt.format }),
  };
}

function createFinalization(
  history: Attempt[],
  certificationId: string,
  draft: ExamDraft,
  questions: Question[],
  endedAt: number,
): ExamFinalization {
  const attempts = questions.map((question, index) => {
    const response = draft.responses[draft.order[index]] ?? {
      durationMs: 0,
      flagged: false,
      selected: [],
    };
    const answeredAt =
      response.selectedAtUtc ??
      new Date(Math.min(response.selectedAt ?? endedAt, draft.deadline)).toISOString();
    return makeAttempt(
      history,
      question,
      [...response.selected],
      'exam',
      response.durationMs,
      answeredAt,
      draft.id,
    );
  });
  return {
    attempts,
    events: attempts.map((attempt) => eventFromAttempt(attempt, certificationId, crypto.randomUUID())),
  };
}

export class ExamFinalizationCache {
  private examId = '';
  private finalization: ExamFinalization | undefined;

  getOrCreate(
    history: Attempt[],
    certificationId: string,
    draft: ExamDraft,
    questions: Question[],
    endedAt: number,
  ) {
    if (this.examId !== draft.id) {
      this.examId = draft.id;
      this.finalization = createFinalization(history, certificationId, draft, questions, endedAt);
    }
    if (!this.finalization) throw new Error('Exam finalization was not created.');
    return this.finalization;
  }
}
