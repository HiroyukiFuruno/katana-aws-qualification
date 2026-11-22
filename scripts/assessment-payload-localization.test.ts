import { expect, test } from 'bun:test';
import { localizeAssessment } from '../src/assessmentLocalization';
import type { AssessmentItem } from '../src/assessmentTypes';

const canonical: AssessmentItem[] = [
  {
    id: 'assessment-localization',
    skill: 'fundamentals',
    prompt: '日本語',
    options: ['A', 'B', 'C'],
    correct: 1,
  },
];

test('localized assessment preserves answer indexes while replacing presentation', () => {
  const localized = localizeAssessment(canonical, [
    { ...canonical[0], prompt: 'Localized', options: ['One', 'Two', 'Three'] },
  ]);
  expect(localized[0].prompt).toBe('Localized');
  expect(localized[0].correct).toBe(1);
  expect(localized[0].options[1]).toBe('Two');
});

test('localized assessment rejects changes to IDs, skills, correct indexes, and option counts', () => {
  expect(() => localizeAssessment(canonical, [{ ...canonical[0], correct: 0 }])).toThrow(
    'invalidQuestionData',
  );
  expect(() => localizeAssessment(canonical, [{ ...canonical[0], options: ['A', 'B'] }])).toThrow(
    'invalidQuestionData',
  );
});
