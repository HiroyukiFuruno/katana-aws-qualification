import { expect, test } from 'bun:test';
import { lessonQuestionRef } from '../src/fundamentals/state/grade';
import {
  saveGuestLessonResponse,
  startGuestLessonFinal,
  submitGuestLessonFinal,
} from '../src/fundamentals/state/guestFinal';
import { guestLessonSnapshot } from '../src/fundamentals/state/guestSnapshot';
import { verifiesImportedGuestLesson } from '../src/fundamentals/state/importReceipt';
import { sourceWithReceipts } from './fundamentals-import-fixture';
import { lessonAsset } from './fundamentals-state-fixture';

test('import snapshot receipts compare instants and choice sets while accounting for unanswered rows', () => {
  const id = '20000000-0000-4000-8000-000000000001';
  let source = startGuestLessonFinal(sourceWithReceipts(), lessonAsset, id, '2026-11-20T10:00:00Z');
  const position = lessonAsset.finalQuestions.findIndex((question) => question.requiredChoices === 2);
  const question = lessonAsset.finalQuestions[position];
  if (!question) throw new Error('The fixture requires a multiple-choice question.');
  source = saveGuestLessonResponse(
    source,
    lessonAsset,
    id,
    position,
    {
      questionRef: lessonQuestionRef(question),
      selected: [...question.correct].reverse(),
      selectedAt: '2026-11-20T10:00:00.123456Z',
      durationMs: 22,
    },
    11,
  );
  source = submitGuestLessonFinal(
    source,
    lessonAsset,
    id,
    '2026-11-20T10:00:01.123456Z',
    Array.from(
      { length: 12 },
      (_, index) => `30000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    ),
  );
  const original = JSON.stringify(source);
  const canonical = guestLessonSnapshot(source, lessonAsset);
  const session = canonical.sessions[0];
  if (!session?.submittedAt) throw new Error('Missing fixture submission.');
  for (const [index, item] of lessonAsset.finalQuestions.entries()) {
    session.responses[String(index)] ??= {
      questionRef: lessonQuestionRef(item),
      selected: [],
      selectedAt: session.submittedAt,
      durationMs: 0,
    };
  }
  const answer = session.responses[String(position)];
  if (!answer) throw new Error('Missing fixture response.');
  answer.selected = [...answer.selected].sort();
  answer.selectedAt = '2026-11-20T11:00:00.123456+01:00';
  session.submittedAt = '2026-11-20T11:00:01.123456+01:00';
  expect(verifiesImportedGuestLesson(canonical, source, lessonAsset)).toBe(true);
  expect(JSON.stringify(source)).toBe(original);
  answer.selectedAt = '2026-11-20T11:00:00.123457+01:00';
  expect(verifiesImportedGuestLesson(canonical, source, lessonAsset)).toBe(false);
});
