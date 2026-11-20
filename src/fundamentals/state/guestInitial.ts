import type { DeliveryUnitAsset } from '../delivery/artifactTypes';
import type { GuestLessonSource } from './types';

export function initialGuestLesson(asset: DeliveryUnitAsset): GuestLessonSource {
  const first = asset.steps[0];
  if (!first || first.kind === 'final' || first.kind === 'checkpoint') {
    throw new Error('A lesson must begin with a reading slide.');
  }
  return {
    unitId: asset.unit.id,
    contentVersion: asset.contentVersion,
    completedSlideIds: [],
    completedCheckpointIds: [],
    furthestPlanPosition: 0,
    resumeStage: 'slide',
    resumeStepId: first.id,
    checkpointReceipts: [],
    activeFinal: null,
    submittedFinals: [],
  };
}

export function assertGuestLessonAsset(source: GuestLessonSource, asset: DeliveryUnitAsset) {
  if (source.unitId !== asset.unit.id || source.contentVersion !== asset.contentVersion) {
    throw new Error('Guest lesson content version changed.');
  }
}
