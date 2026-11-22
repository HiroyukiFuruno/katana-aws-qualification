import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { Locale } from '../src/locales';
import type { Question } from '../src/questions';
import { assertQuestionCachePayload } from './content-translation-cache-binding';
import { assertContentPayloadHash, contentPayloadHash } from './content-translation-provenance';
import { validateTranslation } from './content-translation-validation';
import { validateNaturalReview } from './natural-question-review';
import { naturalQuestionHash } from './natural-translation-content';
import { assertPublishedPayloadHash } from './publication-contract';
import { assertPositionIndependentQuestion } from './question-position-validation';

type Json = string | number | boolean | null | Json[] | { [key: string]: Json | undefined };

async function readJson(path: string) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export async function validateQuestionBank(
  path: string,
  data: Json,
  sourceLocale: Locale,
  selectedLocales: readonly Locale[],
  naturalQuestionCacheExists: boolean,
  publishedPayloadHashes?: Partial<Record<Locale, string>>,
) {
  const sourceHash = createHash('sha256').update(JSON.stringify(data)).digest('hex');
  for (const locale of selectedLocales) {
    const root = `public/translations/${locale}`;
    const manifest: Record<string, string> = await readJson(`${root}/manifest.json`);
    assert.equal(
      manifest[path],
      sourceHash,
      `${locale}/${path}: source changed; regenerate translations`,
    );
    const translation = await readJson(`${root}/${path}`);
    validateTranslation(data, translation, locale, `${locale}/${path}`);
    const payloadManifest: Record<string, string> = await readJson(`${root}/payload-manifest.json`);
    assertContentPayloadHash(translation, payloadManifest[path], `${locale}/${path}`);
    if (publishedPayloadHashes)
      assertPublishedPayloadHash(
        contentPayloadHash(translation),
        publishedPayloadHashes[locale] ?? '',
        `${locale}/${path}`,
      );
    assertPositionIndependentQuestion(translation, `${locale}/${path}`);
    const naturalManifest = await readJson(`${root}/natural-manifest.json`);
    const provenance = naturalManifest[path];
    assert.equal(
      provenance?.sourceHash,
      sourceHash,
      `${locale}/${path}: natural translation source changed`,
    );
    assertContentPayloadHash(translation, provenance?.payloadHash, `${locale}/${path}`);
    const questions = data as Question[];
    assert.equal(
      provenance.questions.length,
      questions.length,
      `${locale}/${path}: incomplete natural translation`,
    );
    for (const [index, question] of questions.entries()) {
      const record = provenance.questions[index];
      assertContentPayloadHash(translation[index], record?.payloadHash, `${locale}/${path}/${index}`);
      validateNaturalReview(question, record.review);
      assert.equal(
        record.review.status,
        'pass',
        `${locale}/${path}/${index}: unresolved semantic issue`,
      );
      assert.equal(
        record.hash,
        naturalQuestionHash(question, sourceLocale),
        `${locale}/${path}/${index}: stale natural translation`,
      );
      assert(
        typeof record.model === 'string' &&
          record.model &&
          typeof record.thread === 'string' &&
          record.thread,
        `${locale}/${path}/${index}: missing AI translation provenance`,
      );
      await assertQuestionCachePayload(
        naturalQuestionCacheExists,
        question,
        sourceLocale,
        locale,
        translation[index],
        {
          model: record.model,
          thread: record.thread,
          review: record.review,
          reviewModel: record.reviewModel ?? record.model,
          reviewThread: record.reviewThread ?? record.thread,
          languageReviews: record.languageReviews,
          reviewResolution: record.reviewResolution,
        },
        `${locale}/${path}/${index}`,
      );
    }
  }
}
