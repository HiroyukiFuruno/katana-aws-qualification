import { expect, test } from 'bun:test';
import { canonical } from './question-localization-fixture';
import { validateNaturalReview } from './natural-question-review';

test('a source question needs an identified review with a rationale and consistent issue status', () => {
  const question = canonical[0];
  const review = {
    id: question.id,
    status: 'pass',
    rationale: 'The stated condition requires the answer in B.',
    issues: [],
  };
  expect(() => validateNaturalReview(question, review)).not.toThrow();
  expect(() => validateNaturalReview(question, undefined)).toThrow('missing semantic review');
  expect(() => validateNaturalReview(question, { ...review, id: 'other' })).toThrow(
    'question ID changed',
  );
  expect(() => validateNaturalReview(question, { ...review, rationale: ' ' })).toThrow('rationale');
  expect(() =>
    validateNaturalReview(question, { ...review, issues: ['Two options satisfy the requirement.'] }),
  ).toThrow('contradicts');
  expect(() =>
    validateNaturalReview(question, {
      ...review,
      status: 'needs-review',
      issues: ['Verify the API limit.'],
    }),
  ).not.toThrow();
});
