import { expect, test } from 'bun:test';
import type { NaturalQuestionRecord } from './natural-question-cache';
import { type QueuedNaturalQuestion, questionTranslationBatches } from './natural-question-queue';
import { canonical } from './question-localization-fixture';

const entries: QueuedNaturalQuestion[] = [
  { hash: 'ja-new', question: canonical[0], sourceLocale: 'ja' },
  { hash: 'fr-new', question: canonical[0], sourceLocale: 'fr' },
  { hash: 'ja-review', question: canonical[0], sourceLocale: 'ja' },
];
const existing = new Map<string, NaturalQuestionRecord>([
  ['ja-review', { locales: {}, model: 'fixture', thread: 'fixture', usage: null }],
]);

test('the queue retains every source language and separates cached reviews from new translations', () => {
  const batches = questionTranslationBatches(entries, existing, 4, Infinity);
  expect(batches.map((batch) => batch.map(({ hash }) => hash))).toEqual([
    ['ja-review'],
    ['ja-new'],
    ['fr-new'],
  ]);
  expect(questionTranslationBatches(entries, existing, 4, 1)).toHaveLength(1);
});

test('invalid queue controls fail instead of silently dropping pending questions', () => {
  expect(() => questionTranslationBatches(entries, existing, NaN, Infinity)).toThrow('batch size');
  expect(() => questionTranslationBatches(entries, existing, 4, NaN)).toThrow('batch limit');
});
