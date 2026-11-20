import { initialGuestLesson } from '../src/fundamentals/state/guestInitial';
import { recordGuestLessonStep } from '../src/fundamentals/state/guestStep';
import { lessonAsset } from './fundamentals-state-fixture';

export function sourceWithReceipts() {
  let source = initialGuestLesson(lessonAsset);
  let receipt = 1;
  for (const step of lessonAsset.steps.filter((item) => item.kind !== 'final')) {
    const question = lessonAsset.checkpoints.find((item) => item.id === step.assessmentId);
    source = recordGuestLessonStep(
      source,
      lessonAsset,
      step.id,
      question
        ? {
            selected: question.correct,
            receiptId: `10000000-0000-4000-8000-${String(receipt++).padStart(12, '0')}`,
            answeredAt: '2026-11-20T10:00:00.123456Z',
            durationMs: 1,
          }
        : undefined,
    ).source;
  }
  return source;
}
