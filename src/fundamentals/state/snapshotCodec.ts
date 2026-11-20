import type { DeliveryUnitAsset } from '../delivery/artifactTypes';
import { object, text } from './codecPrimitives';
import { readLessonProgress } from './progressCodec';
import { readLessonFinalSession } from './sessionCodec';
import type { LessonSnapshot } from './types';

export function readLessonSnapshot(value: unknown, asset: DeliveryUnitAsset): LessonSnapshot {
  const row = object(value, 'snapshot');
  if (row.unitId !== asset.unit.id || row.contentVersion !== asset.contentVersion) {
    throw new Error('The lesson snapshot is from another unit or content version.');
  }
  const progress = readLessonProgress(row.progress, asset);
  if (!Array.isArray(row.sessions)) throw new Error('Invalid lesson sessions.');
  const sessions = row.sessions.map((session) => readLessonFinalSession(session, asset));
  if (new Set(sessions.map((session) => session.sessionId)).size !== sessions.length) {
    throw new Error('Duplicate lesson session identifier.');
  }
  const requiredCount = asset.steps.filter((step) => step.kind !== 'final').length;
  if (
    (progress.activeFinalSessionId !== null ||
      progress.passedFinalSessionId !== null ||
      progress.resumeStage === 'final' ||
      progress.resumeStage === 'result') &&
    progress.furthestPlanPosition !== requiredCount
  ) {
    throw new Error('Required lesson steps are incomplete.');
  }
  const drafts = sessions.filter((session) => session.state === 'draft');
  if (
    drafts.length > 1 ||
    (drafts.length === 1 && drafts[0]?.sessionId !== progress.activeFinalSessionId)
  ) {
    throw new Error('The lesson draft does not match the active session.');
  }
  if (progress.resumeStage === 'result' && !sessions.some((session) => session.state === 'submitted')) {
    throw new Error('The lesson result session is missing.');
  }
  if (
    progress.activeFinalSessionId !== null &&
    !sessions.some(
      (session) => session.sessionId === progress.activeFinalSessionId && session.state === 'draft',
    )
  ) {
    throw new Error('The active lesson session is missing.');
  }
  if (
    progress.passedFinalSessionId !== null &&
    !sessions.some((session) => session.sessionId === progress.passedFinalSessionId && session.passed)
  ) {
    throw new Error('The passing lesson session is missing.');
  }
  const result: LessonSnapshot = {
    unitId: asset.unit.id,
    contentVersion: asset.contentVersion,
    progress,
    sessions,
  };
  if (row.checkpointResult !== undefined) {
    const feedback = object(row.checkpointResult, 'checkpointResult');
    const explanationRef = text(feedback.explanationRef, 'explanationRef');
    if (
      typeof feedback.isCorrect !== 'boolean' ||
      !asset.checkpoints.some((question) => explanationRef === `checkpoint:${question.id}`)
    ) {
      throw new Error('Invalid lesson checkpoint feedback.');
    }
    result.checkpointResult = { isCorrect: feedback.isCorrect, explanationRef };
  }
  return result;
}
