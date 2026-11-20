import { readFileSync } from 'node:fs';
import { parseDeliveryIndex } from '../../src/fundamentals/delivery/loadIndex';
import { parseDeliveryUnit } from '../../src/fundamentals/delivery/loadUnit';
import { lessonQuestionRef } from '../../src/fundamentals/state/grade';
import {
  saveGuestLessonResponse,
  startGuestLessonFinal,
  submitGuestLessonFinal,
} from '../../src/fundamentals/state/guestFinal';
import { initialGuestLesson } from '../../src/fundamentals/state/guestInitial';
import { recordGuestLessonStep } from '../../src/fundamentals/state/guestStep';

const root = 'public/fundamentals/delivery/history/2026-11-20';
const index = parseDeliveryIndex(JSON.parse(readFileSync(`${root}/index.json`, 'utf8')));
const entry = index.units[0];
if (!entry) throw new Error('Missing archived lesson fixture');
export const archivedAsset = parseDeliveryUnit(
  JSON.parse(readFileSync(`${root}/${entry.slug}.json`, 'utf8')),
  entry,
);

export function archivedGuestFinal(submitted: boolean) {
  const asset = archivedAsset;
  let source = initialGuestLesson(asset);
  const time = new Date().toISOString();
  for (const step of asset.steps.filter((step) => step.kind !== 'final')) {
    const question = asset.checkpoints.find((question) => question.id === step.assessmentId);
    source = recordGuestLessonStep(
      source,
      asset,
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
  source = startGuestLessonFinal(source, asset, session, time);
  for (const [position, question] of asset.finalQuestions.entries()) {
    source = saveGuestLessonResponse(
      source,
      asset,
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
        asset,
        session,
        time,
        Array.from({ length: 12 }, () => crypto.randomUUID()),
      )
    : source;
}
