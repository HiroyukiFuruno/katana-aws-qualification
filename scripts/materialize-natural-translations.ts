import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { sourceLocaleOf } from '../src/questionSourceLocale';
import type { Question } from '../src/questions';
import { contentPayloadHash, updateContentPayloadManifest } from './content-translation-provenance';
import type { NaturalQuestionRecord } from './natural-question-cache';
import { validateNaturalReview } from './natural-question-review';
import { mergeNaturalQuestion, naturalQuestionHash } from './natural-translation-content';
import { targetLocalesFor } from './natural-translation-schema';
import { contentJobs } from './translation-data';

const root = 'output/question-quality/ai/natural/cache';
let completed = 0;
let pending = 0;
const jobs = await contentJobs();
const site = jobs.find((job) => job.path === 'site.json');
if (!site) throw new Error('Missing Japanese site source');
await mkdir('public/translations/ja', { recursive: true });
await writeFile('public/translations/ja/site.json', `${JSON.stringify(site.data, null, 2)}\n`);
for (const { path, data } of jobs.filter((job) => job.path !== 'site.json')) {
  const source = data as Question[];
  const sourceLocale = sourceLocaleOf(path);
  const targetLocales = targetLocalesFor(sourceLocale);
  const cached: { hash: string; record: NaturalQuestionRecord }[] = [];
  let ready = true;
  for (const question of source) {
    try {
      const hash = naturalQuestionHash(question, sourceLocale);
      const record: NaturalQuestionRecord = JSON.parse(
        await readFile(join(root, `${hash}.json`), 'utf8'),
      );
      validateNaturalReview(question, record.review);
      if (record.review.status !== 'pass') throw new Error(`${question.id}: unresolved semantic review`);
      for (const locale of targetLocales) mergeNaturalQuestion(question, record.locales[locale], locale);
      cached.push({ hash, record });
    } catch {
      ready = false;
      break;
    }
  }
  if (!ready) {
    pending++;
    continue;
  }
  const sourceHash = createHash('sha256').update(JSON.stringify(data)).digest('hex');
  for (const locale of targetLocales) {
    const outputRoot = `public/translations/${locale}`;
    const output = join(outputRoot, path);
    const translated = source.map((question, index) =>
      mergeNaturalQuestion(question, cached[index].record.locales[locale], locale),
    );
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, `${JSON.stringify(translated, null, 2)}\n`);
    const payloadManifestPath = join(outputRoot, 'payload-manifest.json');
    let payloadManifest: Record<string, string> = {};
    try {
      payloadManifest = JSON.parse(await readFile(payloadManifestPath, 'utf8'));
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    }
    await writeFile(
      payloadManifestPath,
      `${JSON.stringify(updateContentPayloadManifest(payloadManifest, path, translated), null, 2)}\n`,
    );
    for (const [filename, value] of [
      ['manifest.json', sourceHash],
      [
        'natural-manifest.json',
        {
          sourceHash,
          payloadHash: contentPayloadHash(translated),
          questions: cached.map(({ hash, record }, index) => ({
            hash,
            payloadHash: contentPayloadHash(
              mergeNaturalQuestion(source[index], record.locales[locale], locale),
            ),
            model: record.model,
            thread: record.thread,
            review: record.review,
            reviewModel: record.reviewModel ?? record.model,
            reviewThread: record.reviewThread ?? record.thread,
            reviewResolution: (record as NaturalQuestionRecord & { reviewResolution?: unknown })
              .reviewResolution,
            languageReviews: record.languageReviews,
          })),
        },
      ],
    ] as const) {
      const manifestPath = join(outputRoot, filename);
      let manifest = {};
      try {
        manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
      } catch (error) {
        if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
      }
      await writeFile(manifestPath, `${JSON.stringify({ ...manifest, [path]: value }, null, 2)}\n`);
    }
  }
  completed++;
}
console.log(
  `Materialized ${completed} naturally translated banks in 9 locales; ${pending} banks pending`,
);
