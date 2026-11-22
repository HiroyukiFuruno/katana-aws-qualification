import { expect, test } from 'bun:test';
import { examChoiceOrder, newExam } from '../src/exam';
import { isCorrectAnswer, questionKey, type Question } from '../src/questions';
import { randomizePracticeQuestions, randomizeQuestion } from '../src/randomization';

const question: Question = {
  id: 'randomization-test',
  revision: 1,
  category: 'domain',
  version: '1',
  title: 'Randomization',
  prompt: 'Prompt',
  choices: ['A', 'B', 'C'].map((id) => ({ id, text: id, explanation: id })),
  correct: ['B'],
  source: { label: 'AWS', url: 'https://docs.aws.amazon.com/' },
};

test('practice randomization preserves canonical choices and grading', () => {
  const randomized = randomizeQuestion(question, () => 0);
  expect(randomized.choices.map(({ id }) => id)).toEqual(['B', 'C', 'A']);
  expect(question.choices.map(({ id }) => id)).toEqual(['A', 'B', 'C']);
  expect(isCorrectAnswer(randomized, ['B'])).toBe(true);

  const session = randomizePracticeQuestions([question, { ...question, id: 'second' }], () => 0);
  expect(session.map(({ id }) => id)).toEqual(['second', 'randomization-test']);
  expect(session.flatMap(({ choices }) => choices.map(({ id }) => id)).sort()).toEqual([
    'A',
    'A',
    'B',
    'B',
    'C',
    'C',
  ]);
});

test('exam choice orders are persisted and old drafts retain canonical ordering', () => {
  const draft = newExam([question], { minutes: 1, distribution: { domain: 1 } }, 0);
  const key = questionKey(question);
  expect(examChoiceOrder(draft, question)).toEqual(draft.choiceOrders?.[key]);
  expect(new Set(examChoiceOrder(draft, question))).toEqual(new Set(['A', 'B', 'C']));
  expect(examChoiceOrder({ ...draft, choiceOrders: undefined }, question)).toEqual(['A', 'B', 'C']);
  expect(examChoiceOrder({ ...draft, choiceOrders: { [key]: ['A', 'A', 'C'] } }, question)).toEqual([
    'A',
    'B',
    'C',
  ]);
});
