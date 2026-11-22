import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertNarrativeCachePayload } from './content-translation-cache-binding';
import { assertContentPayloadHash, directoryExists } from './content-translation-provenance';
import { validateTranslation } from './content-translation-validation';
import {
  applyNarrativeUnit,
  fundamentalsTranslationJobs,
  type NarrativeJson,
  narrativeHash,
  narrativeUnits,
} from './fundamentals-translation-data';
import { lessonQuestion } from './natural-lesson-review';
import { narrativeLocales, narrativeRoot } from './natural-narrative-translation';
import { validateNaturalReview } from './natural-question-review';

export async function checkFundamentalsContentTranslations() {
  const narrativeCacheExists = await directoryExists(`${narrativeRoot}/cache`);
  let count = 0;
  for (const { path, data } of await fundamentalsTranslationJobs()) {
    const units = narrativeUnits(data);
    for (const locale of narrativeLocales) {
      const root = `public/translations/${locale}`;
      const translation: NarrativeJson = JSON.parse(await readFile(`${root}/${path}`, 'utf8'));
      const payloadManifest: Record<string, string> = JSON.parse(
        await readFile(`${root}/payload-manifest.json`, 'utf8'),
      );
      const naturalManifest = JSON.parse(await readFile(`${root}/natural-manifest.json`, 'utf8'));
      const provenance = naturalManifest[path];
      assert.equal(
        provenance?.sourceHash,
        narrativeHash(data),
        `${locale}/${path}: lesson source changed`,
      );
      assertContentPayloadHash(translation, provenance?.payloadHash, `${locale}/${path}`);
      assertContentPayloadHash(translation, payloadManifest[path], `${locale}/${path}`);
      assert.equal(
        provenance.units.length,
        units.length,
        `${locale}/${path}: incomplete lesson translation`,
      );
      const expected = structuredClone(data);
      for (const [index, unit] of units.entries()) {
        const record = provenance.units[index];
        assert.equal(record.hash, unit.hash, `${locale}/${path}: stale lesson translation`);
        assert(
          record.thread && record.model,
          `${locale}/${path}: missing lesson translation provenance`,
        );
        const question = lessonQuestion(unit);
        if (question) {
          validateNaturalReview(question, record.review?.review);
          assert.equal(
            record.review.review.status,
            'pass',
            `${locale}/${path}: unresolved lesson semantic issue`,
          );
          assert(
            record.review.model && record.review.thread,
            `${locale}/${path}: missing lesson review provenance`,
          );
        }
        const texts = unit.fields.map((field) => {
          let value = translation;
          for (const segment of [...unit.path, ...field.path]) {
            assert(value && typeof value === 'object', `${locale}/${path}: missing lesson field`);
            value = (value as Record<string, NarrativeJson>)[segment];
          }
          validateTranslation(field.text, value, locale, `${locale}/${path}/${field.path.join('.')}`);
          assert(typeof value === 'string', `${locale}/${path}: invalid lesson text`);
          return value;
        });
        assertContentPayloadHash(texts, record?.payloadHash, `${locale}/${path}/${index}`);
        await assertNarrativeCachePayload(
          narrativeCacheExists,
          unit,
          locale,
          texts,
          record.review,
          `${locale}/${path}/${index}`,
        );
        applyNarrativeUnit(expected, unit, texts);
      }
      assert.deepEqual(translation, expected, `${locale}/${path}: lesson identity or structure changed`);
      count++;
    }
  }
  return count;
}
