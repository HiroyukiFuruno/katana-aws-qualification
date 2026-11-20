import { expect, test } from 'bun:test';
import { startGuestLessonFinal, submitGuestLessonFinal } from '../src/fundamentals/state/guestFinal';
import { guestLessonImportWire } from '../src/fundamentals/state/importWire';
import { lessonAsset } from './fundamentals-state-fixture';
import { sourceWithReceipts } from './fundamentals-import-fixture';

test('sends the exact submitted-final wire shape without the UI cursor position', () => {
  const active = startGuestLessonFinal(
    sourceWithReceipts(),
    lessonAsset,
    '10000000-0000-4000-8000-000000000090',
    '2026-11-20T10:00:00.123456Z',
  );
  const source = submitGuestLessonFinal(
    active,
    lessonAsset,
    '10000000-0000-4000-8000-000000000090',
    '2026-11-20T10:01:00.123456Z',
    Array.from(
      { length: 12 },
      (_, index) => `10000000-0000-4000-8000-${String(index + 100).padStart(12, '0')}`,
    ),
  );
  const final = guestLessonImportWire(source).submittedFinals[0];
  expect(Object.keys(source.submittedFinals[0] ?? {}).sort()).toContain('position');
  expect(Object.keys(final ?? {}).sort()).toEqual([
    'eventIds',
    'questionOrder',
    'responses',
    'sessionId',
    'startedAt',
    'submittedAt',
  ]);
});
