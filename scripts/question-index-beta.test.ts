import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { questionKey, type Question } from '../src/questions';

test('the published question index resolves every English-source MLA-C02 beta question', () => {
  const questions: Question[] = JSON.parse(
    readFileSync('public/courses/mla-c02/mock-2026-11.json', 'utf8'),
  );
  const index = JSON.parse(readFileSync('public/learning-question-index.v1.json', 'utf8'));
  expect(questions).toHaveLength(425);
  for (const question of questions)
    expect(index.questions[questionKey(question)]).toEqual([
      'mla-c02',
      'courses/mla-c02/mock-2026-11.json',
    ]);
});
