import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { locales } from '../src/locales';
import sourceLocales from '../src/question-source-locales.json';
import { sourceLocaleOf } from '../src/questionSourceLocale';
import { checkFundamentalsContentTranslations } from './check-fundamentals-content-translations';
import { directoryExists } from './content-translation-provenance';
import { validateTranslation } from './content-translation-validation';
import { checkLegacyNaturalExports } from './legacy-natural-exports';
import {
  assertPhaseAPublicationScope,
  assertPublicationContract,
  type PublicationContract,
  publishedLocales,
} from './publication-contract';
import { validateQuestionBank } from './question-translation-publication-check';
import { contentJobs } from './translation-data';

type CheckMode = 'full' | 'published';
const translationRoot = 'public/translations';

async function readJson(path: string) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export async function checkContentTranslations(
  mode: CheckMode = 'full',
  supplied?: PublicationContract,
) {
  assert(mode !== 'full' || !supplied, 'Full content check cannot use a publication contract');
  const naturalQuestionCacheExists = await directoryExists('output/question-quality/ai/natural/cache');
  const jobs = await contentJobs();
  const questions = jobs.filter((job) => job.path !== 'site.json');
  assert.deepEqual(
    await readJson(`${translationRoot}/ja/site.json`),
    jobs.find((job) => job.path === 'site.json')?.data,
    'Published Japanese site content differs from its source',
  );
  const contract =
    supplied ??
    (mode === 'published'
      ? ((await readJson(`${translationRoot}/published-content.v1.json`)) as PublicationContract)
      : undefined);
  if (contract) {
    const entries = questions.map(({ path, data }) => ({
      path,
      sourceLocale: sourceLocaleOf(path),
      sourceHash: createHash('sha256').update(JSON.stringify(data)).digest('hex'),
    }));
    assertPublicationContract(contract, entries, (sourceLocale) =>
      locales.filter((locale) => locale !== sourceLocale),
    );
    if (mode === 'published') assertPhaseAPublicationScope(contract);
  }
  let count = 0;
  for (const { path, data } of questions) {
    assert(path in sourceLocales, `${path}: source language is not declared`);
    const sourceLocale = sourceLocaleOf(path);
    const selected = contract
      ? publishedLocales(
          contract.banks[path],
          locales.filter((locale) => locale !== sourceLocale),
        )
      : locales.filter((locale) => locale !== sourceLocale);
    await validateQuestionBank(
      path,
      data,
      sourceLocale,
      selected,
      naturalQuestionCacheExists,
      contract
        ? Object.fromEntries(
            selected.map((locale) => [locale, contract.banks[path].translations[locale]?.payloadHash]),
          )
        : undefined,
    );
    count += selected.length;
  }
  for (const locale of locales.filter((locale) => locale !== 'ja')) {
    const root = `${translationRoot}/${locale}`;
    const site = jobs.find((job) => job.path === 'site.json');
    assert(site, 'Missing site translation source');
    const manifest: Record<string, string> = await readJson(`${root}/manifest.json`);
    const sourceHash = createHash('sha256').update(JSON.stringify(site.data)).digest('hex');
    assert.equal(manifest['site.json'], sourceHash, `${locale}/site.json: source changed`);
    validateTranslation(site.data, await readJson(`${root}/site.json`), locale, `${locale}/site.json`);
    count++;
  }
  count += await checkFundamentalsContentTranslations();
  await checkLegacyNaturalExports();
  return count;
}

if (import.meta.main) {
  const mode: CheckMode = process.argv.includes('--published') ? 'published' : 'full';
  const count = await checkContentTranslations(mode);
  console.log(
    `Validated ${count} localized site/question files with source hashes, canonical IDs and natural translation provenance`,
  );
}
