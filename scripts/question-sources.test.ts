import { expect, test } from 'bun:test';
import type { FundamentalsContent } from '../src/fundamentals/types';
import { parseQuestions } from '../src/questions';

const content = (await Bun.file('public/fundamentals/content.json').json()) as FundamentalsContent;
const question = content.units.flatMap((unit) => unit.questions).find((item) => item.references?.length);
if (!question) throw new Error('Missing multi-source learning fixture');

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
