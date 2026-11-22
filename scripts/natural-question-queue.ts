import assert from 'node:assert/strict';
import type { Locale } from '../src/locales';
import { sourceLocaleOf } from '../src/questionSourceLocale';
import type { Question } from '../src/questions';
import { type NaturalQuestionRecord, readNaturalQuestion } from './natural-question-cache';
import { validateNaturalReview } from './natural-question-review';
import { naturalQuestionHash } from './natural-translation-content';

export type QueuedNaturalQuestion = { hash: string; question: Question; sourceLocale: Locale };

export function questionTranslationBatches(
  pending: QueuedNaturalQuestion[],
  existing: ReadonlyMap<string, NaturalQuestionRecord>,
  batchSize: number,
  limit: number,
) {
  assert(Number.isSafeInteger(batchSize) && batchSize >= 1 && batchSize <= 8, 'Invalid batch size');
  assert(limit === Infinity || (Number.isSafeInteger(limit) && limit >= 0), 'Invalid batch limit');
  return [...new Set(['ja', 'en', ...pending.map((entry) => entry.sourceLocale)])]
    .flatMap((sourceLocale) =>
      [true, false].flatMap((cached) => {
        const entries = pending.filter(
          (entry) => entry.sourceLocale === sourceLocale && existing.has(entry.hash) === cached,
        );
        return Array.from({ length: Math.ceil(entries.length / batchSize) }, (_, index) =>
          entries.slice(index * batchSize, index * batchSize + batchSize),
        );
      }),
    )
    .slice(0, limit);
}

export async function naturalQuestionQueue(
  jobs: readonly { path: string; data: unknown }[],
  batchSize: number,
  limit: number,
) {
  const unique = new Map<string, QueuedNaturalQuestion>();
  for (const job of jobs.filter((job) => job.path !== 'site.json'))
    for (const question of job.data as Question[]) {
      const sourceLocale = sourceLocaleOf(job.path);
      const hash = naturalQuestionHash(question, sourceLocale);
      unique.set(hash, { hash, question, sourceLocale });
    }
  const pending: QueuedNaturalQuestion[] = [];
  const existing = new Map<string, NaturalQuestionRecord>();
  for (const entry of unique.values()) {
    try {
      const cached = await readNaturalQuestion(entry.question, entry.sourceLocale);
      existing.set(entry.hash, cached);
      validateNaturalReview(entry.question, cached.review);
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        error.code !== 'ENOENT' &&
        error.code !== 'ERR_ASSERTION'
      )
        throw error;
      pending.push(entry);
    }
  }
  return {
    total: unique.size,
    completed: unique.size - pending.length,
    existing,
    batches: questionTranslationBatches(pending, existing, batchSize, limit),
  };
}
