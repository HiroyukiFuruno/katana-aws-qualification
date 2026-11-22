import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { aiBusinessStrategistCourse } from '../src/aiBusinessStrategistCourse';
import type { Question } from '../src/questions';
import { assertContentPayloadHash, contentPayloadHash } from './content-translation-provenance';
import { validateTranslation } from './content-translation-validation';
import { legacyQuestionTranslation } from './legacy-question-translation';
import { validateNaturalReview } from './natural-question-review';
import { naturalQuestionHash } from './natural-translation-content';
import { targetLocalesFor } from './natural-translation-schema';
import { contentJobs } from './translation-data';

type Provenance = {
  sourceHash: string;
  payloadHash: string;
  questions: { hash: string; payloadHash: string; model: string; thread: string; review: unknown }[];
};
const hash = contentPayloadHash;

export async function legacyNaturalExports() {
  const paths = [aiBusinessStrategistCourse.mock, ...(aiBusinessStrategistCourse.archives ?? [])].filter(
    (path): path is string => Boolean(path),
  );
  const jobs = await contentJobs();
  const sources = paths.map((path) => {
    const job = jobs.find((job) => job.path === path);
    assert(job, `Missing legacy source bank: ${path}`);
    return job;
  });
  const outputs = [];
  for (const locale of targetLocalesFor('ja')) {
    const manifest: Record<string, Provenance> = JSON.parse(
      await readFile(`public/translations/${locale}/natural-manifest.json`, 'utf8'),
    );
    const payload: ReturnType<typeof legacyQuestionTranslation> = {
      categories: {},
      sourceLabels: {},
      questions: {},
    };
    const banks: Record<string, Provenance> = {};
    for (const job of sources) {
      const canonical = job.data as Question[];
      const provenance = manifest[job.path];
      assert.equal(
        provenance?.sourceHash,
        hash(job.data),
        `${locale}/${job.path}: missing natural legacy source`,
      );
      assert.equal(
        provenance.questions.length,
        canonical.length,
        `${locale}/${job.path}: incomplete legacy provenance`,
      );
      for (const [index, question] of canonical.entries()) {
        const record = provenance.questions[index];
        validateNaturalReview(question, record.review);
        assert.equal(
          record.review.status,
          'pass',
          `${locale}/${question.id}: unresolved legacy semantic issue`,
        );
        assert.equal(
          record.hash,
          naturalQuestionHash(question),
          `${locale}/${question.id}: stale legacy source`,
        );
        assert(
          typeof record.model === 'string' &&
            record.model &&
            typeof record.thread === 'string' &&
            record.thread,
          `${locale}/${question.id}: missing legacy AI provenance`,
        );
      }
      const value: unknown = JSON.parse(
        await readFile(`public/translations/${locale}/${job.path}`, 'utf8'),
      );
      validateTranslation(job.data, value as typeof job.data, locale, `${locale}/${job.path}`);
      assertContentPayloadHash(value, provenance.payloadHash, `${locale}/${job.path}`);
      for (const [index, question] of (value as Question[]).entries())
        assertContentPayloadHash(
          question,
          provenance.questions[index]?.payloadHash,
          `${locale}/${job.path}/${index}`,
        );
      // 改訂アーカイブは同一IDを保持するため、単一バンクの検証は結合する前に行う。
      const bankPayload = legacyQuestionTranslation(canonical, value as Question[]);
      for (const [key, label] of Object.entries(bankPayload.categories))
        payload.categories[key] ??= label;
      for (const [key, label] of Object.entries(bankPayload.sourceLabels))
        payload.sourceLabels[key] ??= label;
      for (const [key, question] of Object.entries(bankPayload.questions)) {
        assert(!Object.hasOwn(payload.questions, key), `Duplicate legacy question identity: ${key}`);
        payload.questions[key] = question;
      }
      banks[job.path] = provenance;
    }
    outputs.push({ locale, payload, manifest: { payloadHash: hash(payload), banks } });
  }
  return outputs;
}

export async function checkLegacyNaturalExports() {
  const outputs = await legacyNaturalExports();
  for (const { locale, payload, manifest } of outputs) {
    const actual: unknown = JSON.parse(
      await readFile(`public/courses/ai-business-strategist/locales/${locale}.json`, 'utf8'),
    );
    assert.deepEqual(
      actual,
      payload,
      `${locale}: legacy translations differ from reviewed natural translations`,
    );
    const provenance: unknown = JSON.parse(
      await readFile(`public/translations/${locale}/legacy-natural-manifest.json`, 'utf8'),
    );
    assert.deepEqual(provenance, manifest, `${locale}: legacy natural translation provenance changed`);
  }
  console.log(`Validated ${outputs.length} legacy natural translation exports`);
}
