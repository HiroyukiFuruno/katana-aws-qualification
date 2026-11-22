import assert from 'node:assert/strict';
import type { Locale } from '../src/locales';
import type { Question } from '../src/questions';
import type { NarrativeUnit } from './fundamentals-translation-data';
import { readLessonReview } from './natural-lesson-review';
import { readNarrative } from './natural-narrative-translation';
import { readNaturalQuestion } from './natural-question-cache';
import { mergeNaturalQuestion } from './natural-translation-content';

export async function assertQuestionCachePayload(
  cacheExists: boolean,
  question: Question,
  sourceLocale: string,
  locale: Locale,
  published: unknown,
  publishedProvenance: unknown,
  context: string,
) {
  if (!cacheExists) return;
  const cached = await readNaturalQuestion(question, sourceLocale);
  assert.deepEqual(
    published,
    mergeNaturalQuestion(question, cached.locales[locale], locale),
    `${context}: published translation differs from cache`,
  );
  assert.deepEqual(
    {
      model: cached.model,
      thread: cached.thread,
      review: cached.review,
      reviewModel: cached.reviewModel ?? cached.model,
      reviewThread: cached.reviewThread ?? cached.thread,
      languageReviews: cached.languageReviews,
      reviewResolution: (cached as Record<string, unknown>).reviewResolution,
    },
    publishedProvenance,
    `${context}: published translation provenance differs from cache`,
  );
}

export async function assertNarrativeCachePayload(
  cacheExists: boolean,
  unit: NarrativeUnit,
  locale: Locale,
  published: string[],
  publishedReview: unknown,
  context: string,
) {
  if (!cacheExists) return;
  const cached = await readNarrative(unit);
  assert.deepEqual(
    published,
    cached.locales[locale],
    `${context}: published lesson translation differs from cache`,
  );
  if (publishedReview !== undefined)
    assert.deepEqual(
      await readLessonReview(unit),
      publishedReview,
      `${context}: published lesson review provenance differs from cache`,
    );
}
