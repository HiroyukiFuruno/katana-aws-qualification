import type { DeliveryUnitAsset } from '../delivery/artifactTypes';
import { lessonQuestionRef } from './grade';
import { saveGuestLessonResponse, startGuestLessonFinal, submitGuestLessonFinal } from './guestFinal';
import { guestLessonSnapshot } from './guestSnapshot';
import { recordGuestLessonStep } from './guestStep';
import type { GuestLessonStorage } from './guestStorage';
import type { MemberLessonRepository } from './memberTypes';

export type LessonLearningRepository = Pick<
  MemberLessonRepository,
  'load' | 'recordStep' | 'startFinal' | 'saveResponse' | 'finalize'
>;

export function createGuestLessonRepository(storage: GuestLessonStorage): LessonLearningRepository {
  async function change(asset: DeliveryUnitAsset, update: Parameters<GuestLessonStorage['change']>[1]) {
    return guestLessonSnapshot(await storage.change(asset, update), asset);
  }
  return {
    load: async (asset) => guestLessonSnapshot(await storage.read(asset), asset),
    async recordStep(asset, input) {
      let feedback: { isCorrect: boolean; explanationRef: string } | undefined;
      const snapshot = await change(asset, (source) => {
        const result = recordGuestLessonStep(
          source,
          asset,
          input.stepId,
          input.selected
            ? {
                selected: input.selected,
                receiptId: input.receiptId,
                answeredAt:
                  source.checkpointReceipts.find((item) => item.receiptId === input.receiptId)
                    ?.answeredAt ?? new Date().toISOString(),
                durationMs: input.durationMs,
              }
            : undefined,
        );
        if (result.isCorrect !== undefined) {
          const step = asset.steps.find((step) => step.id === input.stepId);
          feedback = {
            isCorrect: result.isCorrect,
            explanationRef: `checkpoint:${step?.assessmentId}`,
          };
        }
        return result.source;
      });
      return { ...snapshot, ...(feedback ? { checkpointResult: feedback } : {}) };
    },
    startFinal: (asset, input) =>
      change(asset, (source) =>
        startGuestLessonFinal(source, asset, input.sessionId, new Date().toISOString()),
      ),
    saveResponse: (asset, input) =>
      change(asset, (source) => {
        const question = asset.finalQuestions[input.position];
        if (!question) throw new Error('Lesson question is missing.');
        return saveGuestLessonResponse(
          source,
          asset,
          input.sessionId,
          input.position,
          {
            questionRef: lessonQuestionRef(question),
            selected: input.selected,
            selectedAt: new Date().toISOString(),
            durationMs: input.durationMs,
          },
          input.cursorPosition,
        );
      }),
    finalize: (asset, input) =>
      change(asset, (source) => {
        if (source.submittedFinals.some((session) => session.sessionId === input.sessionId)) {
          return source;
        }
        return submitGuestLessonFinal(
          source,
          asset,
          input.sessionId,
          new Date().toISOString(),
          Array.from({ length: 12 }, () => crypto.randomUUID()),
        );
      }),
  };
}
