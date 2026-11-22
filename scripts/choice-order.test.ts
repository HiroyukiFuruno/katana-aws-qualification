import { expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ExamSolution } from '../src/ExamSolution';
import { examChoiceOrder } from '../src/exam';
import type { Attempt } from '../src/history';
import { messages } from '../src/messages';
import { type Question, questionKey } from '../src/questions';

const question: Question = {
  id: 'choice-order-test',
  revision: 1,
  category: 'domain',
  version: '1',
  title: 'Choice order',
  prompt: 'Which choice is correct?',
  choices: ['A', 'B', 'C'].map((id) => ({
    id,
    text: `Text ${id}`,
    explanation: `Explanation ${id}`,
  })),
  correct: ['B'],
  source: { label: 'AWS', url: 'https://docs.aws.amazon.com/' },
};

const attempt: Attempt = {
  schemaVersion: 1,
  questionId: question.id,
  questionRevision: question.revision,
  category: question.category,
  sourceVersion: question.version,
  answeredAt: '2026-11-21T00:00:00.000Z',
  selected: ['A'],
  correct: ['B'],
  isCorrect: false,
  durationMs: 1,
  attemptNumber: 1,
  priorIncorrectCount: 0,
  mode: 'exam',
  reviewCorrect: null,
  reward: 0,
};

test('choice order accepts only complete permutations and falls back to canonical IDs', () => {
  const draft = { id: 'test', deadline: 1, order: [], position: 0, responses: {} };
  const key = questionKey(question);
  expect(examChoiceOrder({ ...draft, choiceOrders: { [key]: ['C', 'A', 'B'] } }, question)).toEqual([
    'C',
    'A',
    'B',
  ]);
  for (const order of [['A'], [], ['A', 'X', 'C'], ['A', 'A', 'C'], undefined]) {
    expect(
      examChoiceOrder({ ...draft, choiceOrders: order ? { [key]: order } : undefined }, question),
    ).toEqual(['A', 'B', 'C']);
  }
  expect(question.correct).toEqual(['B']);
});

test('exam result renders every choice in valid order and falls back for malformed order', () => {
  const render = (choiceOrder: string[] | undefined) =>
    renderToStaticMarkup(
      createElement(ExamSolution, { attempt, item: question, index: 0, choiceOrder }),
    );
  for (const order of [['A'], [], ['A', 'X', 'C'], ['A', 'A', 'C'], undefined]) {
    const malformed = render(order);
    for (const id of ['A', 'B', 'C']) expect(malformed).toContain(`Explanation ${id}`);
    expect(malformed.indexOf('Text A')).toBeLessThan(malformed.indexOf('Text B'));
    expect(malformed.indexOf('Text B')).toBeLessThan(malformed.indexOf('Text C'));
    expect(malformed).toContain(`${messages.en.selected} A`);
    expect(malformed).toContain(`${messages.en.correct} B`);
  }
  const valid = render(['C', 'A', 'B']);
  expect(valid).toContain(`${messages.en.selected} B`);
  expect(valid).toContain(`${messages.en.correct} C`);
  expect(valid.indexOf('Text C')).toBeLessThan(valid.indexOf('Text A'));
  expect(valid.indexOf('Text A')).toBeLessThan(valid.indexOf('Text B'));
});
