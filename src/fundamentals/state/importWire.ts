import type { GuestLessonSource } from './types';

export function guestLessonImportWire(source: GuestLessonSource) {
  return {
    unitId: source.unitId,
    contentVersion: source.contentVersion,
    completedSlideIds: source.completedSlideIds,
    completedCheckpointIds: source.completedCheckpointIds,
    furthestPlanPosition: source.furthestPlanPosition,
    resumeStage: source.resumeStage,
    resumeStepId: source.resumeStepId,
    checkpointReceipts: source.checkpointReceipts.map((receipt) => ({
      stepId: receipt.stepId,
      receiptId: receipt.receiptId,
      questionRef: receipt.questionRef,
      selected: receipt.selected,
      answeredAt: receipt.answeredAt,
      durationMs: receipt.durationMs,
    })),
    activeFinal: source.activeFinal && {
      sessionId: source.activeFinal.sessionId,
      startedAt: source.activeFinal.startedAt,
      position: source.activeFinal.position,
      questionOrder: source.activeFinal.questionOrder,
      responses: source.activeFinal.responses,
    },
    submittedFinals: source.submittedFinals.map((session) => ({
      sessionId: session.sessionId,
      startedAt: session.startedAt,
      questionOrder: session.questionOrder,
      responses: session.responses,
      submittedAt: session.submittedAt,
      eventIds: session.eventIds,
    })),
  };
}
