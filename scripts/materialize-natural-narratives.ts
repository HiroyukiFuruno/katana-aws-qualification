import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { contentPayloadHash, updateContentPayloadManifest } from './content-translation-provenance';
import { fundamentalsNarrativeJobs } from './fundamentals-narrative-jobs';
import { applyNarrativeUnit, narrativeHash } from './fundamentals-translation-data';
import { readLessonReview } from './natural-lesson-review';
import { type NaturalNarrativeRecord, narrativeLocales } from './natural-narrative-translation';
import { readLessonTranslation } from './project-lesson-translation';

let completed = 0;
let pending = 0;
for (const { path, data, units } of await fundamentalsNarrativeJobs()) {
  const records: NaturalNarrativeRecord[] = [];
  const reviews: (Awaited<ReturnType<typeof readLessonReview>> | undefined)[] = [];
  let ready = true;
  for (const plan of units) {
    try {
      records.push(await readLessonTranslation(plan));
      const review = await readLessonReview(plan.source);
      if (review && review.review.status !== 'pass')
        throw new Error('Unresolved lesson question review');
      reviews.push(review);
    } catch (error) {
      console.error(`${path}: ${String(error)}`);
      ready = false;
      break;
    }
  }
  if (!ready) {
    pending++;
    continue;
  }
  for (const locale of narrativeLocales) {
    const result = structuredClone(data);
    for (const [index, { unit }] of units.entries())
      applyNarrativeUnit(result, unit, records[index].locales[locale]);
    const root = `public/translations/${locale}`;
    const output = join(root, path);
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, `${JSON.stringify(result, null, 2)}\n`);
    const payloadManifestPath = join(root, 'payload-manifest.json');
    let payloadManifest: Record<string, string> = {};
    try {
      payloadManifest = JSON.parse(await readFile(payloadManifestPath, 'utf8'));
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    }
    await writeFile(
      payloadManifestPath,
      `${JSON.stringify(updateContentPayloadManifest(payloadManifest, path, result), null, 2)}\n`,
    );
    const manifestPath = join(root, 'natural-manifest.json');
    let manifest = {};
    try {
      manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    }
    const provenance = {
      sourceHash: narrativeHash(data),
      payloadHash: contentPayloadHash(result),
      units: units.map(({ unit }, index) => ({
        hash: unit.hash,
        payloadHash: contentPayloadHash(records[index].locales[locale]),
        model: records[index].model,
        thread: records[index].thread,
        review: reviews[index],
      })),
    };
    await writeFile(manifestPath, `${JSON.stringify({ ...manifest, [path]: provenance }, null, 2)}\n`);
  }
  completed++;
}
console.log(`Materialized ${completed} natural lesson files in nine locales; ${pending} files pending`);
