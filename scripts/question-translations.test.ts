import { expect, test } from 'bun:test';
import { makeAttempt } from '../src/attempts';
import { newExam } from '../src/exam';
import { isCorrectAnswer, parseQuestions, questionKey } from '../src/questions';
import { applyQuestionTranslation, questionTranslationPath } from '../src/questionTranslations';

const bank = parseQuestions([
  {
    id: 'aib-test-model',
    revision: 2,
    version: '2026-11',
    category: '基礎',
    similarityGroup: 'model-update',
    title: 'モデルの更新',
    prompt: 'どの手順でモデルを更新するか。',
    choices: [
      { id: 'A', text: '再学習する。', explanation: '再学習でモデルを更新できる。' },
      { id: 'B', text: '推論する。', explanation: '推論ではモデルを更新しない。' },
    ],
    correct: ['A'],
    source: { url: 'https://aws.amazon.com/', label: 'AWS公式資料' },
    learning: { concept: '推論', reason: '推論と再学習を区別する。' },
  },
]);
const translated = {
  categories: { 基礎: 'Fundamentals' },
  sourceLabels: { AWS公式資料: 'AWS documentation' },
  questions: {
    'aib-test-model@2': {
      title: 'Updating a model',
      prompt: 'Which process updates the model?',
      choices: {
        A: { text: 'Retrain it.', explanation: 'Retraining updates the model.' },
        B: { text: 'Run inference.', explanation: 'Inference does not update the model.' },
      },
      learning: { concept: 'Inference', reason: 'Distinguish between inference and retraining.' },
    },
  },
};

test('translates displayed text while keeping the same exam, grade and attempt category', () => {
  const [question] = applyQuestionTranslation(bank, 'en', translated);
  expect(question.locale).toBe('en');
  expect(question.category).toBe('Fundamentals');
  expect(question.prompt).toBe('Which process updates the model?');
  expect(question.learning?.concept).toBe('Inference');
  expect(question.source.label).toBe('AWS documentation');
  expect(question.source.url).toBe(bank[0].source.url);
  expect(questionKey(question)).toBe(questionKey(bank[0]));
  expect(newExam([question], { minutes: 2, distribution: { 基礎: 1 } }).order).toEqual([
    questionKey(bank[0]),
  ]);
  expect(isCorrectAnswer(question, ['A'])).toBe(true);
  expect(isCorrectAnswer(question, ['B'])).toBe(false);
  expect(makeAttempt([], question, ['A'], 'study', 10, '2026-11-20').category).toBe(bank[0].category);
});

test('rejects stale revisions, missing choices and missing learning content', () => {
  const item = translated.questions['aib-test-model@2'];
  expect(() =>
    applyQuestionTranslation(bank, 'en', { ...translated, questions: { 'aib-test-model@1': item } }),
  ).toThrow('invalidQuestionData');
  for (const invalid of [
    { ...item, choices: { A: item.choices.A } },
    { ...item, learning: undefined },
  ]) {
    expect(() =>
      applyQuestionTranslation(bank, 'en', {
        ...translated,
        questions: { 'aib-test-model@2': invalid },
      }),
    ).toThrow('invalidQuestionData');
  }
});

test('selects the locale-specific file only for courses offering question translations', () => {
  expect(questionTranslationPath('courses/example/locales', 'en')).toBe(
    'courses/example/locales/en.json',
  );
  expect(questionTranslationPath('courses/example/locales', 'ja')).toBeUndefined();
  expect(questionTranslationPath(undefined, 'fr')).toBeUndefined();
});
