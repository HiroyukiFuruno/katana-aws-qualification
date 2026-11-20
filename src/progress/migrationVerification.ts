import type { Attempt } from '../attempts';
import type { MemberEvent } from './member';
import type { LegacyDraft } from './migrationLegacy';

export type ImportedEvent = { attempt: Attempt; certificationId: string; eventId: string };

export function hasImportedEvents(events: readonly MemberEvent[], expected: readonly ImportedEvent[]) {
  return expected.every(({ attempt, certificationId, eventId }) => {
    const event = events.find((item) => item.eventId === eventId);
    return (
      !!event &&
      event.certificationId === certificationId &&
      event.questionId === attempt.questionId &&
      event.questionRevision === attempt.questionRevision &&
      event.sourceVersion === attempt.sourceVersion &&
      event.category === attempt.category &&
      event.answeredAt === attempt.answeredAt &&
      event.mode === attempt.mode &&
      (event.examId ?? '') === (attempt.examId ?? '') &&
      event.isCorrect === attempt.isCorrect &&
      event.durationMs === attempt.durationMs &&
      event.attemptNumber === attempt.attemptNumber &&
      event.priorIncorrectCount === attempt.priorIncorrectCount &&
      event.reviewCorrect === attempt.reviewCorrect &&
      event.reward === attempt.reward &&
      event.format === attempt.format &&
      JSON.stringify(event.selected) === JSON.stringify(attempt.selected) &&
      JSON.stringify(event.correct) === JSON.stringify(attempt.correct)
    );
  });
}

type SessionRow = {
  exam_id: string;
  deadline_at: string;
  position: number;
  question_order: { question_id: string; question_revision: number }[];
  state: string;
};
type ResponseRow = {
  exam_id: string;
  question_key: string;
  selected: string[];
  flagged: boolean;
  duration_ms: number;
  selected_at: string | null;
};
function refs(order: readonly string[]) {
  try {
    return order.map((key) => {
      const value: unknown = JSON.parse(key);
      return Array.isArray(value) && typeof value[0] === 'string' && Number.isInteger(value[1])
        ? { question_id: value[0], question_revision: value[1] as number }
        : undefined;
    });
  } catch {
    return [];
  }
}
export function hasImportedDraft(
  draft: LegacyDraft,
  sessions: readonly SessionRow[],
  responses: readonly ResponseRow[],
) {
  const session = sessions.find((row) => row.exam_id === draft.id);
  const order = refs(draft.order);
  return (
    !!session &&
    session.state === 'draft' &&
    session.position === draft.position &&
    Date.parse(session.deadline_at) === draft.deadline &&
    order.length === draft.order.length &&
    JSON.stringify(session.question_order) === JSON.stringify(order) &&
    responses.filter((row) => row.exam_id === draft.id).length === Object.keys(draft.responses).length &&
    Object.entries(draft.responses).every(([key, response]) => {
      const stored = responses.find((row) => row.exam_id === draft.id && row.question_key === key);
      return (
        !!stored &&
        JSON.stringify(stored.selected) === JSON.stringify(response.selected) &&
        stored.flagged === response.flagged &&
        stored.duration_ms === response.durationMs &&
        (response.selectedAt === undefined
          ? stored.selected_at === null
          : Date.parse(stored.selected_at ?? '') === response.selectedAt)
      );
    })
  );
}
