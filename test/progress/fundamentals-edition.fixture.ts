import legacyRecordAssets from '../../src/fundamentals/delivery/legacyRecordAssets.json' with {
  type: 'json',
};
import { readLessonRecordAsset } from '../../src/fundamentals/delivery/recordAsset';
import { lessonQuestionRef } from '../../src/fundamentals/state/grade';
import {
  saveGuestLessonResponse,
  startGuestLessonFinal,
  submitGuestLessonFinal,
} from '../../src/fundamentals/state/guestFinal';
import { initialGuestLesson } from '../../src/fundamentals/state/guestInitial';
import { recordGuestLessonStep } from '../../src/fundamentals/state/guestStep';

const legacy = legacyRecordAssets.assets[0];
if (!legacy) throw new Error('Missing legacy lesson fixture');
export const archivedAsset = readLessonRecordAsset(legacy, legacy.unit.id, legacy.contentVersion);

export function archivedGuestFinal(submitted: boolean) {
  let source = initialGuestLesson(archivedAsset);
  const time = new Date().toISOString();
  for (const step of archivedAsset.steps.filter((step) => step.kind !== 'final')) {
    const question = archivedAsset.checkpoints.find((question) => question.id === step.assessmentId);
    source = recordGuestLessonStep(
      source,
      archivedAsset,
      step.id,
      question
        ? {
            selected: question.correct,
            receiptId: crypto.randomUUID(),
            answeredAt: time,
            durationMs: 20,
          }
        : undefined,
    ).source;
  }
  const session = crypto.randomUUID();
  source = startGuestLessonFinal(source, archivedAsset, session, time);
  for (const [position, question] of archivedAsset.finalQuestions.entries()) {
    source = saveGuestLessonResponse(
      source,
      archivedAsset,
      session,
      position,
      {
        questionRef: lessonQuestionRef(question),
        selected: question.correct,
        selectedAt: time,
        durationMs: 20,
      },
      position,
    );
  }
  return submitted
    ? submitGuestLessonFinal(
        source,
        archivedAsset,
        session,
        time,
        Array.from({ length: 12 }, () => crypto.randomUUID()),
      )
    : source;
}
