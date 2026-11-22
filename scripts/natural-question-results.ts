import assert from 'node:assert/strict';
import type { Locale } from '../src/locales';
import type { Question } from '../src/questions';
import { validateNaturalQuestionBatch } from './natural-question-batch';
import { type NaturalQuestionReview, validateNaturalReview } from './natural-question-review';

type ValidQuestionResult = {
  index: number;
  review: NaturalQuestionReview;
  locales: Record<string, Record<string, unknown>>;
};

export function inspectNaturalQuestionResults(
  questions: Question[],
  value: unknown,
  locales: readonly Locale[],
  reviewOnly = false,
) {
  assert(value && typeof value === 'object' && !Array.isArray(value), 'Missing question results');
  const result = value as Record<string, unknown>;
  assert(
    Array.isArray(result.reviews) && result.reviews.length === questions.length,
    'Missing per-question semantic reviews',
  );
  const translations: Record<string, unknown[]> = {};
  if (!reviewOnly) {
    assert(
      result.locales && typeof result.locales === 'object' && !Array.isArray(result.locales),
      'Missing translation locales',
    );
    const values = result.locales as Record<string, unknown>;
    for (const locale of locales) {
      const entries = values[locale];
      assert(
        Array.isArray(entries) && entries.length === questions.length,
        `${locale}: natural translation changed batch length`,
      );
      translations[locale] = entries;
    }
  }
  const valid: ValidQuestionResult[] = [];
  const failed: { index: number; error: string }[] = [];
  for (const [index, question] of questions.entries()) {
    try {
      const review: unknown = result.reviews[index];
      validateNaturalReview(question, review);
      const payload: Record<string, Record<string, unknown>> = {};
      if (!reviewOnly) {
        const single = Object.fromEntries(
          locales.map((locale) => [locale, [translations[locale][index]]]),
        );
        validateNaturalQuestionBatch([question], single, locales);
        for (const locale of locales)
          payload[locale] = translations[locale][index] as Record<string, unknown>;
      }
      valid.push({ index, review, locales: payload });
    } catch (error) {
      failed.push({ index, error: String(error) });
    }
  }
  return { valid, failed };
}
