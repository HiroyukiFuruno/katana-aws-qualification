import assert from 'node:assert/strict';
import type { Question } from '../src/questions';

export type NaturalQuestionReview = {
  id: string;
  status: 'pass' | 'needs-review';
  rationale: string;
  issues: string[];
};
export function validateNaturalReview(
  question: Pick<Question, 'id'>,
  value: unknown,
): asserts value is NaturalQuestionReview {
  assert(value && typeof value === 'object', `${question.id}: missing semantic review`);
  const review = value as Record<string, unknown>;
  assert.equal(review.id, question.id, 'Semantic review question ID changed');
  assert(review.status === 'pass' || review.status === 'needs-review', 'Invalid semantic review status');
  assert(
    typeof review.rationale === 'string' && review.rationale.trim(),
    'Missing question-specific review rationale',
  );
  assert(
    Array.isArray(review.issues) &&
      review.issues.every((issue) => typeof issue === 'string' && issue.trim()),
    'Invalid semantic review issues',
  );
  assert.equal(
    review.status === 'pass',
    review.issues.length === 0,
    'Semantic review status contradicts unresolved issues',
  );
}
