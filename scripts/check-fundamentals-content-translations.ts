import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertNarrativeCachePayload } from './content-translation-cache-binding';
import { assertContentPayloadHash, directoryExists } from './content-translation-provenance';
import { validateTranslation } from './content-translation-validation';
import { fundamentalsAuthoringPath, fundamentalsNarrativeJobs } from './fundamentals-narrative-jobs';
import {
  applyNarrativeUnit,
  assertLessonNarrativeAlignment,
  type NarrativeJson,
  narrativeHash,
} from './fundamentals-translation-data';
import { lessonQuestion } from './natural-lesson-review';
import { narrativeLocales, narrativeRoot } from './natural-narrative-translation';
import { validateNaturalReview } from './natural-question-review';
import { assertLessonTranslationSource, lessonNarrativeTexts } from './project-lesson-translation';

export async function checkFundamentalsContentTranslations() {
  const narrativeCacheExists = await directoryExists(`${narrativeRoot}/cache`);
  const jobs = await fundamentalsNarrativeJobs();
  let count = 0;
  for (const locale of narrativeLocales) {
    const root = `public/translations/${locale}`;
    const authoring: NarrativeJson = JSON.parse(
      await readFile(`${root}/${fundamentalsAuthoringPath}`, 'utf8'),
    );
    for (const { path, data, units } of jobs) {
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
      for (const [index, plan] of units.entries()) {
        const { unit } = plan;
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
        const context = `${locale}/${path}/${index}`;
        const texts = lessonNarrativeTexts(translation, unit, context);
        for (const [fieldIndex, field] of unit.fields.entries()) {
          validateTranslation(
            field.text,
            texts[fieldIndex],
            locale,
            `${context}/${field.path.join('.')}`,
            field.path.at(-1),
          );
        }
        assertLessonTranslationSource(plan, authoring, texts, context);
        assertLessonNarrativeAlignment(unit, texts, locale);
        assertContentPayloadHash(texts, record?.payloadHash, `${locale}/${path}/${index}`);
        await assertNarrativeCachePayload(
          narrativeCacheExists,
          plan,
          locale,
          { texts, model: record.model, thread: record.thread, review: record.review },
          context,
        );
        applyNarrativeUnit(expected, unit, texts);
      }
      assert.deepEqual(translation, expected, `${locale}/${path}: lesson identity or structure changed`);
      count++;
    }
  }
  return count;
}
