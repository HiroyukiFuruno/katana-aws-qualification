import type { ProgressRpcClient } from '../../progress/types';
import type { DeliveryQuestion, DeliveryUnitAsset } from '../delivery/artifactTypes';
import { isLessonAnswerCorrect, lessonQuestionRef } from './grade';
import { sameLessonInstant } from './instant';
import type { GuestLessonSource, LessonResponse } from './types';

type Expected = {
  answeredAt: string;
  durationMs: number;
  eventId: string;
  question: DeliveryQuestion;
  selected: string[];
  sessionId: string | null;
  stepId?: string;
  position?: number;
};

function sameSelection(left: unknown, right: readonly string[]) {
  return (
    Array.isArray(left) &&
    left.length === right.length &&
    [...left].sort().every((item, index) => item === [...right].sort()[index])
  );
}

function sameJson(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((item, index) => sameJson(item, right[index]))
    );
  }
  const leftRow = left as Record<string, unknown>;
  const rightRow = right as Record<string, unknown>;
  const keys = Object.keys(leftRow);
  return (
    keys.length === Object.keys(rightRow).length &&
    keys.every((key) => key in rightRow && sameJson(leftRow[key], rightRow[key]))
  );
}

function expected(source: GuestLessonSource, asset: DeliveryUnitAsset) {
  const checkpoints: Expected[] = source.checkpointReceipts.map((receipt) => {
    const step = asset.steps.find((item) => item.id === receipt.stepId);
    const question = asset.checkpoints.find((item) => item.id === step?.assessmentId);
    if (!question) throw new Error('Guest checkpoint is outside the asset.');
    return {
      answeredAt: receipt.answeredAt,
      durationMs: receipt.durationMs,
      eventId: receipt.receiptId,
      question,
      selected: receipt.selected,
      sessionId: null,
      stepId: receipt.stepId,
    };
  });
  const finals = source.submittedFinals.flatMap((session) =>
    asset.finalQuestions.map((question, position) => {
      const response =
        session.responses[String(position)] ??
        ({
          questionRef: lessonQuestionRef(question),
          selected: [],
          selectedAt: session.submittedAt,
          durationMs: 0,
        } satisfies LessonResponse);
      return {
        answeredAt: response.selectedAt,
        durationMs: response.durationMs,
        eventId: session.eventIds[position] ?? '',
        question,
        selected: response.selected,
        sessionId: session.sessionId,
        position,
      };
    }),
  );
  return [...checkpoints, ...finals];
}

function context(event: Expected, asset: DeliveryUnitAsset) {
  const base = {
    unitId: asset.unit.id,
    contentVersion: asset.contentVersion,
    catalogHash: asset.contentHash,
    questionRef: lessonQuestionRef(event.question),
  };
  return event.sessionId
    ? { ...base, kind: 'lesson-final', sessionId: event.sessionId, position: event.position }
    : { ...base, kind: 'lesson-checkpoint', stepId: event.stepId };
}

function rowMatches(row: unknown, event: Expected, asset: DeliveryUnitAsset) {
  if (!row || typeof row !== 'object') return false;
  const value = row as Record<string, unknown>;
  const correct = event.question.correct;
  return (
    value.event_id === event.eventId &&
    value.certification_id === 'fundamentals' &&
    value.question_id === event.question.id &&
    value.question_revision === event.question.revision &&
    value.source_version === event.question.version &&
    value.category === event.question.category &&
    value.mode === 'study' &&
    sameSelection(value.selected, event.selected) &&
    sameSelection(value.correct, correct) &&
    value.is_correct === isLessonAnswerCorrect(event.question, event.selected) &&
    value.duration_ms === event.durationMs &&
    typeof value.answered_at === 'string' &&
    sameLessonInstant(value.answered_at, event.answeredAt) &&
    value.fundamentals_session_id === event.sessionId &&
    value.selection_polarity === event.question.selectionPolarity &&
    value.required_choices === event.question.requiredChoices &&
    sameJson(value.learning_context, context(event, asset))
  );
}

export async function verifiesImportedEvents(
  client: ProgressRpcClient,
  source: GuestLessonSource,
  asset: DeliveryUnitAsset,
) {
  const events = expected(source, asset);
  for (let offset = 0; offset < events.length; offset += 64) {
    const batch = events.slice(offset, offset + 64);
    const ids = batch.map((event) => event.eventId);
    const rows = await client.select<unknown[]>('learning_events', {
      event_id: `in.(${ids.join(',')})`,
    });
    if (
      rows.length !== batch.length ||
      batch.some((event) => !rows.some((row) => rowMatches(row, event, asset)))
    )
      return false;
  }
  return true;
}
