import { expect, test } from 'bun:test';
import type { DeliveryQuestion } from '../src/fundamentals/delivery/artifactTypes';
import { gradeLessonFinal, isLessonAnswerCorrect } from '../src/fundamentals/state/grade';

const question: DeliveryQuestion = {
  category: 'fundamentals.example',
  choices: [
    { id: 'a', text: 'A', explanation: 'A explanation' },
    { id: 'b', text: 'B', explanation: 'B explanation' },
    { id: 'c', text: 'C', explanation: 'C explanation' },
  ],
  correct: ['a'],
  id: 'example',
  objectiveId: 'objective',
  prompt: 'Select the requested choice.',
  requiredChoices: 1,
  revision: 1,
  sectionId: 'section',
  selectionPolarity: 'correct',
  source: { label: 'Fixture', url: 'https://example.com/' },
  title: 'Fixture',
  unitId: 'fundamentals.example',
  version: 'v1',
};

const questions = Array.from({ length: 12 }, (_, index) => ({ ...question, id: `q-${index}` }));

function responses(positions: number[]) {
  return Object.fromEntries(positions.map((position) => [String(position), { selected: ['a'] }]));
}

test('a final requires ten of twelve correct and unanswered questions remain incorrect', () => {
  for (const score of [0, 9, 10, 12]) {
    expect(gradeLessonFinal(questions, responses(Array.from({ length: score }, (_, i) => i)))).toEqual({
      score,
      requiredScore: 10,
      passed: score >= 10,
    });
  }
});

test('different final attempts never pool their correct responses', () => {
  const firstAttempt = responses([0, 1, 2, 3, 4, 5]);
  const secondAttempt = responses([6, 7, 8, 9, 10, 11]);
  expect(gradeLessonFinal(questions, firstAttempt)).toEqual({
    score: 6,
    requiredScore: 10,
    passed: false,
  });
  expect(gradeLessonFinal(questions, secondAttempt)).toEqual({
    score: 6,
    requiredScore: 10,
    passed: false,
  });
  expect(gradeLessonFinal(questions, firstAttempt).passed).toBe(false);
});

test('correct and incorrect wording use the exact requested choice set for both answer forms', () => {
  for (const selectionPolarity of ['correct', 'incorrect'] as const) {
    expect(isLessonAnswerCorrect({ ...question, selectionPolarity }, ['a'])).toBe(true);
    expect(isLessonAnswerCorrect({ ...question, selectionPolarity }, ['c'])).toBe(false);
    const multiple = { ...question, selectionPolarity, correct: ['a', 'b'], requiredChoices: 2 };
    expect(isLessonAnswerCorrect(multiple, ['b', 'a'])).toBe(true);
    expect(isLessonAnswerCorrect(multiple, ['a'])).toBe(false);
    expect(isLessonAnswerCorrect(multiple, ['a', 'c'])).toBe(false);
    expect(() => isLessonAnswerCorrect(multiple, ['a', 'a'])).toThrow();
  }
});

test('invalid choice identifiers and responses outside the fixed order are rejected', () => {
  expect(() => gradeLessonFinal(questions, { 0: { selected: ['unknown'] } })).toThrow();
  expect(() => gradeLessonFinal(questions, { 12: { selected: ['a'] } })).toThrow();
  expect(() => gradeLessonFinal(questions, { '01': { selected: ['a'] } })).toThrow();
  expect(() => gradeLessonFinal(questions.slice(0, 11), {})).toThrow();
});
