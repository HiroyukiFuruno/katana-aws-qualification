import assert from 'node:assert/strict';
import type { Locale } from '../src/locales';
import type { Question } from '../src/questions';
import type { NarrativePlanEntry } from './fundamentals-narrative-jobs';
import { readLessonReview } from './natural-lesson-review';
import { readNaturalQuestion } from './natural-question-cache';
import { mergeNaturalQuestion } from './natural-translation-content';
import { readLessonTranslation } from './project-lesson-translation';

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
  plan: NarrativePlanEntry,
  locale: Locale,
  published: { texts: string[]; model: string; thread: string; review?: unknown },
  context: string,
) {
  if (!cacheExists) return;
  const cached = await readLessonTranslation(plan);
  assert.deepEqual(
    published.texts,
    cached.locales[locale],
    `${context}: published lesson translation differs from cache`,
  );
  assert.equal(
    published.model,
    cached.model,
    `${context}: published lesson translation model differs from cache`,
  );
  assert.equal(
    published.thread,
    cached.thread,
    `${context}: published lesson translation thread differs from cache`,
  );
  if (published.review !== undefined)
    assert.deepEqual(
      await readLessonReview(plan.source),
      published.review,
      `${context}: published lesson review provenance differs from cache`,
    );
}
