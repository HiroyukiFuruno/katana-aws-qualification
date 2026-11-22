import { expect, test } from 'bun:test';
import { parseQuestions } from '../src/questions';
import { naturalQuestionInput } from './natural-question-input';

const bank = parseQuestions(await Bun.file('public/courses/dva-c03/mock-2026-11.json').json());
const question = bank.find((item) => item.id === 'dva-c03-d1-020');
if (!question) throw new Error('Missing real Query projection fixture.');

test('translation input lists exact per-field identifiers while preserving the full source context', () => {
  const input = naturalQuestionInput([question], 'ja', ['en', 'fr'], false);
  const fields = input.identifiersByQuestion[0].fields;
  expect(fields.find((field) => field.path.join('.') === 'prompt')?.tokens).toContain('Query');
  expect(fields.find((field) => field.path.join('.') === 'prompt')?.tokens).toContain('shipmentDate');
  expect(fields.find((field) => field.path.join('.') === 'choices.3.text')?.tokens).toContain(
    'BatchGetItem',
  );
  expect(fields.some((field) => field.path[0] === 'source')).toBe(false);
  expect(input.questions[0]).toEqual({ ...question, references: question.references ?? null });
  expect(input.questions[0].correct).toEqual(question.correct);
  expect(input.targetLocales).toEqual(['en', 'fr']);
});

test('semantic-only review input preserves all options without requesting translations', () => {
  const feedback = 'en: Query missing\nfr: Scan missing';
  const input = naturalQuestionInput([question], 'ja', ['en', 'fr'], true, feedback);
  expect(input.targetLocales).toEqual([]);
  expect(input.identifiersByQuestion).toEqual([]);
  expect(input.questions[0].choices).toEqual(question.choices);
  expect(input.validationFeedback).toBe(feedback);
});
