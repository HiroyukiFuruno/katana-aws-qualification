import type { Attempt } from '../attempts';
import { questionKey, refs, storedQuestionKey } from './examRepositoryCodec';
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
      sameTimestamp(event.answeredAt, attempt.answeredAt) &&
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
function sameTimestamp(left: string, right: string) {
  const leftMs = Date.parse(left);
  const rightMs = Date.parse(right);
  return Number.isFinite(leftMs) && Number.isFinite(rightMs) && leftMs === rightMs;
}

function sameEpochTimestamp(value: string | null, expected: number) {
  const actual = value === null ? Number.NaN : Date.parse(value);
  return Number.isFinite(actual) && Number.isInteger(expected) && actual === expected;
}

function canonicalQuestionKey(value: string) {
  try {
    return Array.isArray(JSON.parse(value)) ? questionKey(refs([value])[0]) : storedQuestionKey(value);
  } catch {
    return undefined;
  }
}
export function hasImportedDraft(
  draft: LegacyDraft,
  sessions: readonly SessionRow[],
  responses: readonly ResponseRow[],
) {
  const session = sessions.find((row) => row.exam_id === draft.id);
  const order = draft.order.map(canonicalQuestionKey);
  const storedOrder = session?.question_order.map((item) => questionKey(item));
  return (
    !!session &&
    session.state === 'draft' &&
    session.position === draft.position &&
    Date.parse(session.deadline_at) === draft.deadline &&
    order.length === draft.order.length &&
    order.every((item): item is string => item !== undefined) &&
    JSON.stringify(storedOrder) === JSON.stringify(order) &&
    responses.filter((row) => row.exam_id === draft.id).length === Object.keys(draft.responses).length &&
    Object.entries(draft.responses).every(([key, response]) => {
      const canonicalKey = canonicalQuestionKey(key);
      const stored = responses.find(
        (row) => row.exam_id === draft.id && canonicalQuestionKey(row.question_key) === canonicalKey,
      );
      return (
        !!stored &&
        JSON.stringify(stored.selected) === JSON.stringify(response.selected) &&
        stored.flagged === response.flagged &&
        stored.duration_ms === response.durationMs &&
        (response.selectedAt === undefined
          ? stored.selected_at === null
          : sameEpochTimestamp(stored.selected_at, response.selectedAt))
      );
    })
  );
}
