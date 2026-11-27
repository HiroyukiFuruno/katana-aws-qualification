import type { LessonRecordAsset } from '../delivery/recordAsset';
import { gradeLessonFinal } from './grade';
import { assertGuestLessonAsset } from './guestInitial';
import { readLessonSnapshot } from './snapshotCodec';
import type { GuestLessonSource, LessonFinalSession } from './types';

export function guestLessonSnapshot(source: GuestLessonSource, asset: LessonRecordAsset) {
  assertGuestLessonAsset(source, asset);
  const submitted: LessonFinalSession[] = source.submittedFinals.map((session) => ({
    sessionId: session.sessionId,
    position: session.position,
    state: 'submitted',
    responses: session.responses,
    ...gradeLessonFinal(asset.finalQuestions, session.responses),
    submittedAt: session.submittedAt,
    revision: 0,
  }));
  const firstPass = submitted.find((session) => session.passed);
  const active = source.activeFinal;
  const sessions = active
    ? [
        ...submitted,
        {
          sessionId: active.sessionId,
          position: active.position,
          state: 'draft',
          responses: active.responses,
          score: null,
          requiredScore: asset.finalPolicy.passCorrect,
          passed: null,
          submittedAt: null,
          revision: 0,
        },
      ]
    : submitted;
  return readLessonSnapshot(
    {
      unitId: source.unitId,
      contentVersion: source.contentVersion,
      progress: {
        completedSlideIds: source.completedSlideIds,
        completedCheckpointIds: source.completedCheckpointIds,
        furthestPlanPosition: source.furthestPlanPosition,
        resumeStage: source.resumeStage,
        resumeStepId: source.resumeStepId,
        activeFinalSessionId: active?.sessionId ?? null,
        passedFinalSessionId: firstPass?.sessionId ?? null,
        passedAt: firstPass?.submittedAt ?? null,
        revision: 0,
      },
      sessions,
    },
    asset,
  );
}
