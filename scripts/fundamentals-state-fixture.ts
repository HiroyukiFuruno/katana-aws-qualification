import data from '../public/fundamentals/delivery/cloud-concepts.json' with { type: 'json' };
import type { DeliveryUnitAsset } from '../src/fundamentals/delivery/artifactTypes';
import { lessonQuestionRef } from '../src/fundamentals/state/grade';
import type { LessonSnapshot } from '../src/fundamentals/state/types';

export const lessonAsset = data as DeliveryUnitAsset;
// 新規の最終試験は提示方式v1をUUIDv8で永続化する。
export const lessonSessionId = '00000000-0000-8000-8000-000000000001';
export const lessonDate = '2026-11-20T10:00:00.123456+00:00';

export function emptyLessonSnapshot(): LessonSnapshot {
  return {
    unitId: lessonAsset.unit.id,
    contentVersion: lessonAsset.contentVersion,
    progress: {
      completedSlideIds: [],
      completedCheckpointIds: [],
      furthestPlanPosition: 0,
      resumeStage: 'slide',
      resumeStepId: null,
      activeFinalSessionId: null,
      passedFinalSessionId: null,
      passedAt: null,
      revision: 0,
    },
    sessions: [],
  };
}

export function passedLessonSnapshot(): LessonSnapshot {
  const snapshot = emptyLessonSnapshot();
  const nonFinal = lessonAsset.steps.filter((step) => step.kind !== 'final');
  snapshot.progress = {
    ...snapshot.progress,
    completedSlideIds: nonFinal.filter((step) => step.kind !== 'checkpoint').map((step) => step.id),
    completedCheckpointIds: nonFinal.filter((step) => step.kind === 'checkpoint').map((step) => step.id),
    furthestPlanPosition: nonFinal.length,
    resumeStage: 'result',
    passedFinalSessionId: lessonSessionId,
    passedAt: lessonDate,
    revision: nonFinal.length + 1,
  };
  snapshot.sessions.push({
    sessionId: lessonSessionId,
    position: 11,
    state: 'submitted',
    responses: Object.fromEntries(
      lessonAsset.finalQuestions.slice(0, 10).map((question, position) => [
        String(position),
        {
          questionRef: lessonQuestionRef(question),
          selected: question.correct,
          selectedAt: lessonDate,
          durationMs: 1000,
        },
      ]),
    ),
    score: 10,
    requiredScore: 10,
    passed: true,
    submittedAt: lessonDate,
    revision: 11,
  });
  return snapshot;
}
