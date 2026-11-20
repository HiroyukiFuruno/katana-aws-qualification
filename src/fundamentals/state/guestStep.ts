import type { DeliveryUnitAsset } from '../delivery/artifactTypes';
import { integer, timestamp, uuid } from './codecPrimitives';
import { isLessonAnswerCorrect, lessonQuestionRef, validateLessonSelection } from './grade';
import { assertGuestLessonAsset } from './guestInitial';
import type { GuestLessonSource } from './types';

export type GuestStepAnswer = {
  selected: string[];
  receiptId: string;
  answeredAt: string;
  durationMs: number;
};

export function recordGuestLessonStep(
  source: GuestLessonSource,
  asset: DeliveryUnitAsset,
  stepId: string,
  answer?: GuestStepAnswer,
): { source: GuestLessonSource; isCorrect?: boolean } {
  assertGuestLessonAsset(source, asset);
  const plan = asset.steps.filter((step) => step.kind !== 'final');
  const position = plan.findIndex((step) => step.id === stepId);
  const step = plan[position];
  if (!step || position > source.furthestPlanPosition) {
    throw new Error('Complete the previous lesson step first.');
  }
  let isCorrect: boolean | undefined;
  let receipts = source.checkpointReceipts;
  if (step.kind === 'checkpoint') {
    const question = asset.checkpoints.find((item) => item.id === step.assessmentId);
    if (!question || !answer) throw new Error('A checkpoint answer is required.');
    validateLessonSelection(question, answer.selected);
    if (answer.selected.length !== question.requiredChoices) {
      throw new Error('Select the required number of checkpoint choices.');
    }
    const receiptId = uuid(answer.receiptId, 'receiptId');
    const receipt = {
      stepId,
      receiptId,
      questionRef: lessonQuestionRef(question),
      selected: [...answer.selected],
      answeredAt: timestamp(answer.answeredAt, 'answeredAt'),
      durationMs: integer(answer.durationMs, 'durationMs', 86_400_000),
    };
    const previous = receipts.find((item) => item.receiptId === receiptId);
    if (previous && JSON.stringify(previous) !== JSON.stringify(receipt)) {
      throw new Error('Checkpoint receipt identifier was reused.');
    }
    if (!previous) receipts = [...receipts, receipt];
    isCorrect = isLessonAnswerCorrect(question, answer.selected);
  } else if (answer) {
    throw new Error('Reading slides do not accept checkpoint answers.');
  }
  const slides = [...source.completedSlideIds];
  const checkpoints = [...source.completedCheckpointIds];
  const completed = step.kind === 'checkpoint' ? checkpoints : slides;
  if (!completed.includes(stepId)) completed.push(stepId);
  const furthest = Math.max(source.furthestPlanPosition, position + 1);
  const next = plan[furthest];
  return {
    source: {
      ...source,
      completedSlideIds: slides,
      completedCheckpointIds: checkpoints,
      checkpointReceipts: receipts,
      furthestPlanPosition: furthest,
      resumeStage: next ? (next.kind === 'checkpoint' ? 'checkpoint' : 'slide') : 'final',
      resumeStepId: next?.id ?? null,
    },
    isCorrect,
  };
}
