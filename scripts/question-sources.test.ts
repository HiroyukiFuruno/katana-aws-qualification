import { expect, test } from 'bun:test';
import type { FundamentalsContent } from '../src/fundamentals/types';
import { parseQuestions } from '../src/questions';

const content = (await Bun.file('public/fundamentals/content.json').json()) as FundamentalsContent;
const [unit] = content.units;
const [baseQuestion] = unit.questions;
const secondary = unit.sections?.find(({ source }) => source.url !== baseQuestion.source.url)?.source;
if (!secondary) throw new Error('Missing independent lesson reference.');
const question = { ...baseQuestion, references: [{ ...secondary }] };

test('shared question validation preserves the references needed by multi-topic explanations', () => {
  expect(parseQuestions([question])[0].references).toEqual(question.references);
});

test('incomplete or unsafe additional source data is rejected at the shared boundary', () => {
  for (const references of [
    null,
    {},
    [{ url: 'https://docs.example.test', label: '' }],
    [{ url: 'javascript:alert(1)', label: 'invalid' }],
    [{ label: 'missing URL' }],
  ]) {
    expect(() => parseQuestions([{ ...question, references }])).toThrow('invalidQuestionData');
  }
});
