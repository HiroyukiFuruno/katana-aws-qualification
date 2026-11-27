import type { LessonRecordAsset } from '../delivery/recordAsset';
import {
  exactFields,
  integer,
  nullable,
  object,
  strings,
  text,
  timestamp,
  uuid,
} from './codecPrimitives';
import { lessonQuestionRef, sameLessonQuestionRef, validateLessonSelection } from './grade';
import { readGuestFinal } from './guestFinalCodec';
import { guestLessonSnapshot } from './guestSnapshot';
import { readLessonQuestionRef } from './responseCodec';
import type { GuestLessonSource } from './types';

export function readGuestLessonSource(value: unknown, asset: LessonRecordAsset): GuestLessonSource {
  const row = object(value, 'guestLesson');
  exactFields(row, [
    'unitId',
    'contentVersion',
    'completedSlideIds',
    'completedCheckpointIds',
    'furthestPlanPosition',
    'resumeStage',
    'resumeStepId',
    'checkpointReceipts',
    'activeFinal',
    'submittedFinals',
  ]);
  if (!Array.isArray(row.checkpointReceipts) || !Array.isArray(row.submittedFinals)) {
    throw new Error('Invalid guest lesson receipts.');
  }
  const checkpointReceipts = row.checkpointReceipts.map((value) => {
    const receipt = object(value, 'checkpointReceipt');
    exactFields(receipt, ['stepId', 'receiptId', 'questionRef', 'selected', 'answeredAt', 'durationMs']);
    const stepId = text(receipt.stepId, 'stepId');
    const step = asset.steps.find((item) => item.id === stepId && item.kind === 'checkpoint');
    const question = asset.checkpoints.find((item) => item.id === step?.assessmentId);
    const questionRef = readLessonQuestionRef(receipt.questionRef);
    if (!question || !sameLessonQuestionRef(questionRef, lessonQuestionRef(question))) {
      throw new Error('Guest checkpoint receipt is outside the published plan.');
    }
    const selected = strings(receipt.selected, 'selected');
    validateLessonSelection(question, selected);
    if (selected.length !== question.requiredChoices) throw new Error('Incomplete checkpoint receipt.');
    return {
      stepId,
      receiptId: uuid(receipt.receiptId, 'receiptId'),
      questionRef,
      selected,
      answeredAt: timestamp(receipt.answeredAt, 'answeredAt'),
      durationMs: integer(receipt.durationMs, 'durationMs', 86_400_000),
    };
  });
  const submittedFinals = row.submittedFinals.map((value) => {
    const session = readGuestFinal(value, asset, true);
    const submitted = object(value, 'submittedFinal');
    const submittedAt = timestamp(submitted.submittedAt, 'submittedAt');
    const eventIds = strings(submitted.eventIds, 'eventIds').map((value) => uuid(value, 'eventId'));
    if (
      eventIds.length !== 12 ||
      Date.parse(submittedAt) < Date.parse(session.startedAt) ||
      Object.values(session.responses).some(
        (answer) => Date.parse(answer.selectedAt) > Date.parse(submittedAt),
      )
    ) {
      throw new Error('Invalid guest final submission receipt.');
    }
    return { ...session, submittedAt, eventIds };
  });
  const source: GuestLessonSource = {
    unitId: text(row.unitId, 'unitId'),
    contentVersion: text(row.contentVersion, 'contentVersion'),
    completedSlideIds: strings(row.completedSlideIds, 'completedSlideIds'),
    completedCheckpointIds: strings(row.completedCheckpointIds, 'completedCheckpointIds'),
    furthestPlanPosition: integer(row.furthestPlanPosition, 'furthestPlanPosition'),
    resumeStage: text(row.resumeStage, 'resumeStage') as GuestLessonSource['resumeStage'],
    resumeStepId: nullable(row.resumeStepId, (value) => text(value, 'resumeStepId')),
    checkpointReceipts,
    activeFinal: nullable(row.activeFinal, (value) => readGuestFinal(value, asset)),
    submittedFinals,
  };
  const identifiers = [
    ...checkpointReceipts.map((receipt) => receipt.receiptId),
    ...submittedFinals.flatMap((session) => session.eventIds),
  ];
  if (new Set(identifiers).size !== identifiers.length) throw new Error('Duplicate guest event UUID.');
  if (
    source.completedCheckpointIds.some((id) => !checkpointReceipts.some((item) => item.stepId === id)) ||
    checkpointReceipts.some((item) => !source.completedCheckpointIds.includes(item.stepId))
  ) {
    throw new Error('Guest checkpoint completion lacks its answer receipt.');
  }
  guestLessonSnapshot(source, asset);
  return source;
}
