import type { DeliveryUnitAsset } from '../delivery/artifactTypes';
import { integer, timestamp, uuid } from './codecPrimitives';
import { LessonStateChangedError } from './conflicts';
import { gradeLessonFinal, lessonQuestionRef } from './grade';
import { assertGuestLessonAsset } from './guestInitial';
import { readLessonResponse } from './responseCodec';
import type { GuestLessonSource, LessonResponse } from './types';

export function startGuestLessonFinal(
  source: GuestLessonSource,
  asset: DeliveryUnitAsset,
  sessionId: string,
  startedAt: string,
): GuestLessonSource {
  assertGuestLessonAsset(source, asset);
  const id = uuid(sessionId, 'sessionId');
  if (source.activeFinal) {
    if (source.activeFinal.sessionId !== id) throw new LessonStateChangedError();
    return source;
  }
  const required = asset.steps.filter((step) => step.kind !== 'final').length;
  if (source.furthestPlanPosition !== required) throw new Error('Required lesson steps remain.');
  if (source.submittedFinals.some((item) => item.sessionId === id)) {
    throw new Error('A submitted lesson session cannot be restarted.');
  }
  return {
    ...source,
    resumeStage: 'final',
    resumeStepId: null,
    activeFinal: {
      sessionId: id,
      startedAt: timestamp(startedAt, 'startedAt'),
      questionOrder: asset.finalQuestions.map((question, position) => ({
        ...lessonQuestionRef(question),
        position,
      })),
      position: 0,
      responses: {},
    },
  };
}

export function saveGuestLessonResponse(
  source: GuestLessonSource,
  asset: DeliveryUnitAsset,
  sessionId: string,
  questionPosition: number,
  response: LessonResponse,
  cursorPosition: number,
): GuestLessonSource {
  assertGuestLessonAsset(source, asset);
  const active = source.activeFinal;
  if (!active || active.sessionId !== sessionId) throw new LessonStateChangedError();
  const index = integer(questionPosition, 'questionPosition', 11);
  const question = asset.finalQuestions[index];
  if (!question) throw new Error('The lesson question is missing.');
  const parsed = readLessonResponse(response, question);
  if (Date.parse(parsed.selectedAt) < Date.parse(active.startedAt)) {
    throw new Error('A lesson answer precedes the final session.');
  }
  return {
    ...source,
    resumeStage: 'final',
    resumeStepId: null,
    activeFinal: {
      ...active,
      position: integer(cursorPosition, 'cursorPosition', 11),
      responses: { ...active.responses, [String(index)]: parsed },
    },
  };
}

export function submitGuestLessonFinal(
  source: GuestLessonSource,
  asset: DeliveryUnitAsset,
  sessionId: string,
  submittedAt: string,
  eventIds: string[],
): GuestLessonSource {
  assertGuestLessonAsset(source, asset);
  const active = source.activeFinal;
  if (!active || active.sessionId !== sessionId) throw new LessonStateChangedError();
  const time = timestamp(submittedAt, 'submittedAt');
  if (
    Date.parse(time) < Date.parse(active.startedAt) ||
    Object.values(active.responses).some((answer) => Date.parse(answer.selectedAt) > Date.parse(time))
  ) {
    throw new Error('The lesson submission precedes an answer.');
  }
  const ids = eventIds.map((id) => uuid(id, 'eventId'));
  const previousIds = source.submittedFinals.flatMap((item) => item.eventIds);
  if (ids.length !== 12 || new Set([...ids, ...previousIds]).size !== ids.length + previousIds.length) {
    throw new Error('The lesson final requires twelve distinct event identifiers.');
  }
  gradeLessonFinal(asset.finalQuestions, active.responses);
  return {
    ...source,
    activeFinal: null,
    resumeStage: 'result',
    resumeStepId: null,
    submittedFinals: [...source.submittedFinals, { ...active, submittedAt: time, eventIds: ids }],
  };
}
