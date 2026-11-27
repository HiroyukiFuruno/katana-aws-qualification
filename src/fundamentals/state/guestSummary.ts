import type { DeliveryIndexAsset } from '../delivery/artifactTypes';
import type { LessonAssets } from '../delivery/assets';
import type { LessonRecordAsset } from '../delivery/recordAsset';
import { guestLessonSnapshot } from './guestSnapshot';
import type { GuestLessonStorage } from './guestStorage';
import type { LessonSummary } from './memberTypes';

export async function guestLessonSummary(
  asset: LessonRecordAsset,
  storage: GuestLessonStorage,
): Promise<LessonSummary> {
  const snapshot = guestLessonSnapshot(await storage.read(asset), asset);
  const latest = snapshot.sessions.filter((session) => session.state === 'submitted').at(-1);
  return {
    unitId: asset.unit.id,
    contentVersion: asset.contentVersion,
    completedSlides: snapshot.progress.completedSlideIds.length,
    totalSlides: asset.steps.length - asset.checkpoints.length - asset.finalQuestions.length,
    completedCheckpoints: snapshot.progress.completedCheckpointIds.length,
    totalCheckpoints: asset.checkpoints.length,
    activeFinalSessionId: snapshot.progress.activeFinalSessionId,
    passedAt: snapshot.progress.passedAt,
    latestScore: latest?.score ?? null,
    requiredScore: latest?.requiredScore ?? null,
  };
}

export function guestLessonSummaries(
  index: DeliveryIndexAsset,
  assets: LessonAssets,
  storage: GuestLessonStorage,
): Promise<LessonSummary[]> {
  return Promise.all(
    index.units.map(async (entry): Promise<LessonSummary> => {
      const empty = {
        unitId: entry.unitId,
        contentVersion: entry.contentVersion,
        completedSlides: 0,
        totalSlides: entry.totalSteps - entry.checkpointCount - entry.finalQuestionCount,
        completedCheckpoints: 0,
        totalCheckpoints: entry.checkpointCount,
        activeFinalSessionId: null,
        passedAt: null,
        latestScore: null,
        requiredScore: null,
      };
      if (!storage.hasSource(entry.unitId, entry.contentVersion)) return empty;
      const asset = await assets.unit(entry.unitId, entry.contentVersion);
      return guestLessonSummary(asset, storage);
    }),
  );
}
