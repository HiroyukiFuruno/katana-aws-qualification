import { expect, test } from 'bun:test';
import { inspectNaturalQuestionResults } from './natural-question-results';
import { canonical } from './question-localization-fixture';

const questions = ['Query', 'PutObject'].map((api) => ({
  ...canonical[0],
  prompt: `${api}を実行する。`,
}));
function candidate() {
  return {
    reviews: questions.map(({ id }) => ({ id, status: 'pass', rationale: 'Verified.', issues: [] })),
    locales: Object.fromEntries(
      ['en', 'fr'].map((locale) => [
        locale,
        questions.map((question, index) => ({
          id: question.id,
          title: 'Lookup',
          prompt: `${locale === 'en' ? 'Run' : 'Exécuter'} ${index ? 'PutObject' : 'Query'}.`,
          choices: question.choices,
          learning: null,
          prompts: null,
          references: null,
          categoryLabel: 'Category',
          examDomainLabel: 'Domain',
          versionLabel: '2026',
          sourceLabel: 'AWS',
        })),
      ]),
    ),
  };
}

test('one invalid locale retries only its question and retains the other complete question', () => {
  const value = candidate();
  value.locales.en[1].prompt = 'Upload the object.';
  const result = inspectNaturalQuestionResults(questions, value, ['en', 'fr']);
  expect(result.valid.map(({ index }) => index)).toEqual([0]);
  expect(result.failed.map(({ index }) => index)).toEqual([1]);
  expect(result.failed[0].error).toContain('technical token lost: PutObject');
  expect(result.valid[0].locales.fr.prompt).toBe('Exécuter Query.');
  expect(questions[0].id).toBe(questions[1].id);
});

test('misaligned locale arrays and review arrays cannot be salvaged by position', () => {
  const value = candidate();
  value.locales.fr.pop();
  expect(() => inspectNaturalQuestionResults(questions, value, ['en', 'fr'])).toThrow('batch length');
  expect(() =>
    inspectNaturalQuestionResults(questions, { ...candidate(), reviews: [] }, ['en', 'fr']),
  ).toThrow('semantic reviews');
});

test('invalid review retries its question while unresolved semantic findings remain explicit', () => {
  const value = candidate();
  value.reviews[1].id = 'wrong-question';
  const result = inspectNaturalQuestionResults(questions, value, ['en', 'fr']);
  expect(result.valid.map(({ index }) => index)).toEqual([0]);
  expect(result.failed[0].index).toBe(1);
  const review = {
    id: questions[0].id,
    status: 'needs-review',
    rationale: 'Check.',
    issues: ['Check.'],
  };
  const unresolved = inspectNaturalQuestionResults([questions[0]], { reviews: [review] }, [], true);
  expect(unresolved.valid[0].review.status).toBe('needs-review');
  expect(unresolved.valid[0].locales).toEqual({});
});
