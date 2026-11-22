import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { locales } from '../src/locales';
import { sourceLocaleOf } from '../src/questionSourceLocale';
import { checkContentTranslations } from './check-content-translations';
import type { PublicationContract } from './publication-contract';
import { contentJobs } from './translation-data';

const hash = (value: string | number | boolean | null | object) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

async function naturalManifest(locale: string) {
  try {
    return JSON.parse(
      await readFile(`public/translations/${locale}/natural-manifest.json`, 'utf8'),
    ) as Record<string, { sourceHash: string; payloadHash: string }>;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return {};
    throw error;
  }
}

const jobs = (await contentJobs()).filter((job) => job.path !== 'site.json');
const manifests = Object.fromEntries(
  await Promise.all(locales.map(async (locale) => [locale, await naturalManifest(locale)])),
);
const banks = Object.fromEntries(
  jobs.map(({ path, data }) => {
    const sourceLocale = sourceLocaleOf(path);
    const sourceHash = hash(data);
    const targets = locales.filter((locale) => locale !== sourceLocale);
    const translations = Object.fromEntries(
      targets.flatMap((locale) => {
        const provenance = manifests[locale]?.[path];
        return provenance?.sourceHash === sourceHash && provenance.payloadHash
          ? [[locale, { payloadHash: provenance.payloadHash }]]
          : [];
      }),
    );
    return [path, { sourceLocale, sourceHash, translations }];
  }),
);
const contract: PublicationContract = { schemaVersion: 1, banks };
await checkContentTranslations('published', contract);
await writeFile(
  'public/translations/published-content.v1.json',
  `${JSON.stringify(contract, null, 2)}\n`,
);
