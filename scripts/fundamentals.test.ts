import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { type Attempt, makeAttempt } from '../src/attempts';
import { validFundamentalsContent } from '../src/fundamentals/content';
import { latestFor, statusFor } from '../src/fundamentals/FundamentalsCatalog';
import type { FundamentalsContent } from '../src/fundamentals/types';
import { isAnswerComplete, isCorrectAnswer } from '../src/questions';

const content = JSON.parse(
  await readFile('public/fundamentals/content.json', 'utf8'),
) as FundamentalsContent;

test('基礎教材は12単元catalogと6公開単元を持つ', () => {
  expect(validFundamentalsContent(content)).toBe(true);
  expect(content.catalog).toHaveLength(12);
  expect(content.units).toHaveLength(6);
  expect(content.catalog.filter((unit) => unit.state === 'planned')).toHaveLength(6);
});

test('4形式を設問データで使い、否定設問のcorrectは選択対象を表す', () => {
  const forms = new Set(
    content.units.flatMap((unit) =>
      unit.questions.map((question) => `${question.selectionPolarity}:${question.requiredChoices}`),
    ),
  );
  expect(forms).toEqual(new Set(['correct:1', 'correct:2', 'incorrect:1', 'incorrect:2']));
  const negative = content.units
    .flatMap((unit) => unit.questions)
    .find((question) => question.selectionPolarity === 'incorrect');
  expect(negative && isCorrectAnswer(negative, negative.correct)).toBe(true);
});

test('選択不足と過剰選択は正解にならない', () => {
  const multiple = content.units
    .flatMap((unit) => unit.questions)
    .find((question) => question.requiredChoices === 2);
  if (!multiple) throw new Error('multiple-choice fixture missing');
  expect(isAnswerComplete(multiple, multiple.correct.slice(0, 1))).toBe(false);
  expect(isAnswerComplete(multiple, [...multiple.correct, 'A'])).toBe(false);
  expect(isCorrectAnswer(multiple, multiple.correct)).toBe(true);
});

test('単元状態は最新回答で完了と復習対象を入れ替える', () => {
  const unit = content.units[0];
  expect(statusFor(unit, latestFor([]))).toBe('notStarted');
  const first = makeAttempt(
    [],
    unit.questions[0],
    unit.questions[0].correct,
    'study',
    0,
    '2026-11-20T00:00:00.000Z',
  );
  expect(statusFor(unit, latestFor([first]))).toBe('inProgress');
  const wrongChoice = unit.questions[0].choices.find(
    (choice) => !unit.questions[0].correct.includes(choice.id),
  );
  if (!wrongChoice) throw new Error('wrong choice fixture missing');
  const wrong = makeAttempt(
    [first],
    unit.questions[0],
    [wrongChoice.id],
    'study',
    0,
    '2026-11-20T00:01:00.000Z',
  );
  expect(statusFor(unit, latestFor([first, wrong]))).toBe('review');
  const fixed = makeAttempt(
    [first, wrong],
    unit.questions[0],
    unit.questions[0].correct,
    'review',
    0,
    '2026-11-20T00:02:00.000Z',
  );
  expect(statusFor(unit, latestFor([first, wrong, fixed]))).toBe('inProgress');
  const complete: Attempt[] = [fixed];
  for (const question of unit.questions.slice(1)) {
    complete.push(
      makeAttempt(complete, question, question.correct, 'study', 0, '2026-11-20T00:03:00.000Z'),
    );
  }
  expect(statusFor(unit, latestFor(complete))).toBe('completed');
});

test('metadata参照と共通設問validatorの負例を拒否する', () => {
  const duplicate = structuredClone(content);
  duplicate.catalog[1].id = duplicate.catalog[0].id;
  expect(validFundamentalsContent(duplicate)).toBe(false);
  const brokenPrerequisite = structuredClone(content);
  brokenPrerequisite.catalog[0].prerequisiteIds = ['fundamentals.missing'];
  expect(validFundamentalsContent(brokenPrerequisite)).toBe(false);
  const missingSource = structuredClone(content);
  Reflect.deleteProperty(missingSource.units[0].questions[0], 'source');
  expect(validFundamentalsContent(missingSource)).toBe(false);
  const duplicateQuestion = structuredClone(content);
  duplicateQuestion.units[1].questions[0].id = duplicateQuestion.units[0].questions[0].id;
  expect(validFundamentalsContent(duplicateQuestion)).toBe(false);
});
