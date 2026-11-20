import { expect, test } from 'bun:test';
import { canAdvanceLesson } from '../src/fundamentals/learner/lessonAdvance';

test('checkpoint confirmation is required for the current display, including retry and revisit', () => {
  const base = {
    blocked: false,
    kind: 'checkpoint' as const,
    active: false,
    selectedCount: 1,
    requiredChoices: 1,
  };
  expect(canAdvanceLesson({ ...base, feedback: false })).toBe(false);
  expect(canAdvanceLesson({ ...base, feedback: true })).toBe(true);
  expect(canAdvanceLesson({ ...base, blocked: true, feedback: true })).toBe(false);
});

test('an active final requires exactly the required choice count for both next and final submission', () => {
  for (const requiredChoices of [1, 2, 3]) {
    for (const selectedCount of [0, 1, 2, 3, 4]) {
      expect(
        canAdvanceLesson({
          blocked: false,
          kind: 'final',
          active: true,
          feedback: false,
          requiredChoices,
          selectedCount,
        }),
      ).toBe(selectedCount === requiredChoices);
    }
  }
  expect(
    canAdvanceLesson({ blocked: false, kind: 'final', active: true, feedback: true, selectedCount: 1 }),
  ).toBe(false);
});

test('reading and the pre-final instructions remain navigable but saving blocks all advancement', () => {
  for (const kind of ['intro', 'reading', 'example', 'misconception', 'takeaway', 'final'] as const) {
    const base = { kind, active: false, feedback: false, selectedCount: 0 };
    expect(canAdvanceLesson({ ...base, blocked: false })).toBe(true);
    expect(canAdvanceLesson({ ...base, blocked: true })).toBe(false);
  }
});
