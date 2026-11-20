import type { DeliveryUnitAsset } from '../delivery/artifactTypes';
import { exactFields, integer, object, timestamp, uuid } from './codecPrimitives';
import { lessonQuestionRef, sameLessonQuestionRef } from './grade';
import { readLessonQuestionRef, readLessonResponses } from './responseCodec';
import type { GuestFinalSource } from './types';

export function readGuestFinal(
  value: unknown,
  asset: DeliveryUnitAsset,
  submitted = false,
): GuestFinalSource {
  const row = object(value, 'guestFinal');
  exactFields(row, [
    'sessionId',
    'startedAt',
    'position',
    'questionOrder',
    'responses',
    ...(submitted ? ['submittedAt', 'eventIds'] : []),
  ]);
  if (!Array.isArray(row.questionOrder) || row.questionOrder.length !== 12) {
    throw new Error('Invalid guest lesson fixed question order.');
  }
  const questionOrder = row.questionOrder.map((value, position) => {
    const ref = readLessonQuestionRef(value);
    const question = asset.finalQuestions[position];
    if (
      !question ||
      !sameLessonQuestionRef(ref, lessonQuestionRef(question)) ||
      object(value, 'questionOrder').position !== position
    ) {
      throw new Error('Guest final question order differs from the published lesson.');
    }
    return { ...ref, position };
  });
  const startedAt = timestamp(row.startedAt, 'startedAt');
  const responses = readLessonResponses(row.responses, asset.finalQuestions);
  if (Object.values(responses).some((answer) => Date.parse(answer.selectedAt) < Date.parse(startedAt))) {
    throw new Error('Guest final answer precedes the session.');
  }
  return {
    sessionId: uuid(row.sessionId, 'sessionId'),
    startedAt,
    position: integer(row.position, 'position', 11),
    questionOrder,
    responses,
  };
}
