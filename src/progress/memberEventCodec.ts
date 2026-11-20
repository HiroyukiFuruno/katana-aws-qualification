import type { Attempt } from '../attempts';

export type MemberEvent = Attempt & { certificationId: string; eventId: string };

export function eventPayload(event: MemberEvent) {
  const { certificationId, eventId, format, ...attempt } = event;
  return {
    event_id: eventId,
    certification_id: certificationId,
    schema_version: attempt.schemaVersion,
    question_id: attempt.questionId,
    question_revision: attempt.questionRevision,
    source_version: attempt.sourceVersion,
    category: attempt.category,
    mode: attempt.mode,
    exam_id: attempt.examId ?? '',
    answered_at: attempt.answeredAt,
    selected: attempt.selected,
    correct: attempt.correct,
    ...(format === undefined ? {} : { answer_format: format }),
    is_correct: attempt.isCorrect,
    duration_ms: attempt.durationMs,
    attempt_number: attempt.attemptNumber,
    prior_incorrect_count: attempt.priorIncorrectCount,
    review_correct: attempt.reviewCorrect,
    reward: attempt.reward,
  };
}

type LearningEventRow = {
  answer_format?: Attempt['format'] | null;
  answered_at: string;
  attempt_number: number;
  category: string;
  certification_id: string;
  correct: string[];
  duration_ms: number;
  event_id: string;
  exam_id?: string | null;
  is_correct: boolean;
  mode: Attempt['mode'];
  prior_incorrect_count: number;
  question_id: string;
  question_revision: number;
  review_correct: boolean | null;
  reward: 0 | 1;
  schema_version: 1;
  selected: string[];
  source_version: string;
};

export function eventFromRow(row: LearningEventRow): MemberEvent {
  return {
    schemaVersion: row.schema_version,
    questionId: row.question_id,
    questionRevision: row.question_revision,
    category: row.category,
    sourceVersion: row.source_version,
    answeredAt: row.answered_at,
    selected: row.selected,
    correct: row.correct,
    ...(row.answer_format == null ? {} : { format: row.answer_format }),
    isCorrect: row.is_correct,
    durationMs: row.duration_ms,
    attemptNumber: row.attempt_number,
    priorIncorrectCount: row.prior_incorrect_count,
    mode: row.mode,
    ...(row.exam_id == null ? {} : { examId: row.exam_id }),
    reviewCorrect: row.review_correct,
    reward: row.reward,
    certificationId: row.certification_id,
    eventId: row.event_id,
  };
}
