import type { DeliveryUnitAsset } from '../delivery/artifactTypes';
import { integer, nullable, object, strings, text, timestamp, uuid } from './codecPrimitives';
import type { LessonProgress } from './types';

export function readLessonProgress(value: unknown, asset: DeliveryUnitAsset): LessonProgress {
  const row = object(value, 'progress');
  const slides = strings(row.completedSlideIds, 'completedSlideIds');
  const checkpoints = strings(row.completedCheckpointIds, 'completedCheckpointIds');
  const plan = asset.steps.filter((step) => step.kind !== 'final');
  for (const id of slides) {
    if (!plan.some((step) => step.kind !== 'checkpoint' && step.id === id)) {
      throw new Error('A completed slide is outside the published plan.');
    }
  }
  for (const id of checkpoints) {
    if (!plan.some((step) => step.kind === 'checkpoint' && step.id === id)) {
      throw new Error('A completed checkpoint is outside the published plan.');
    }
  }
  const completed = new Set([...slides, ...checkpoints]);
  let gap = false;
  for (const step of plan) {
    if (!completed.has(step.id)) gap = true;
    else if (gap) throw new Error('Completed lesson steps do not form a reachable sequence.');
  }
  const furthest = integer(row.furthestPlanPosition, 'furthestPlanPosition', plan.length);
  if (furthest !== completed.size) throw new Error('The lesson position does not match completion.');
  const stage = text(row.resumeStage, 'resumeStage');
  if (!['slide', 'checkpoint', 'final', 'result'].includes(stage)) {
    throw new Error('Invalid lesson resume stage.');
  }
  const resumeStepId = nullable(row.resumeStepId, (item) => text(item, 'resumeStepId'));
  if ((stage === 'final' || stage === 'result') && resumeStepId !== null) {
    throw new Error('Final and result stages use their dedicated session position.');
  }
  if (resumeStepId !== null && !plan.some((step) => step.id === resumeStepId)) {
    throw new Error('The lesson resume step is outside the published plan.');
  }
  const passedFinalSessionId = nullable(row.passedFinalSessionId, (item) =>
    uuid(item, 'passedFinalSessionId'),
  );
  const passedAt = nullable(row.passedAt, (item) => timestamp(item, 'passedAt'));
  if ((passedFinalSessionId === null) !== (passedAt === null)) {
    throw new Error('The lesson pass receipt is incomplete.');
  }
  return {
    completedSlideIds: slides,
    completedCheckpointIds: checkpoints,
    furthestPlanPosition: furthest,
    resumeStage: stage as LessonProgress['resumeStage'],
    resumeStepId,
    activeFinalSessionId: nullable(row.activeFinalSessionId, (item) =>
      uuid(item, 'activeFinalSessionId'),
    ),
    passedFinalSessionId,
    passedAt,
    revision: integer(row.revision, 'progress.revision'),
  };
}
