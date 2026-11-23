import { expect, test } from 'bun:test';
import packageJson from '../package.json' with { type: 'json' };
import type { Locale } from '../src/locales';
import { checkContentTranslations } from './check-content-translations';
import {
  assertFullPublicationScope,
  assertPublicationContract,
  assertPublishedPayloadHash,
  type PublicationContract,
} from './publication-contract';

const hash = (character: string) => character.repeat(64);
const targets = (sourceLocale: Locale) =>
  (['ja', 'en', 'de', 'es', 'fr', 'it', 'ko', 'pt', 'zh-CN', 'zh-TW'] as Locale[]).filter(
    (locale) => locale !== sourceLocale,
  );
const jobs = [
  { path: 'courses/ready.json', sourceLocale: 'ja' as const, sourceHash: hash('a') },
  { path: 'courses/source-only.json', sourceLocale: 'en' as const, sourceHash: hash('b') },
];
const contract = (): PublicationContract => ({
  schemaVersion: 1,
  banks: {
    'courses/ready.json': {
      sourceLocale: 'ja',
      sourceHash: hash('a'),
      translations: Object.fromEntries(
        targets('ja').map((locale) => [locale, { payloadHash: hash('c') }]),
      ),
    },
    'courses/source-only.json': { sourceLocale: 'en', sourceHash: hash('b'), translations: {} },
  },
});

const fullJobs = Array.from({ length: 42 }, (_, index) => ({
  path: `courses/full-${index + 1}.json`,
  sourceLocale: (index === 41 ? 'en' : 'ja') as Locale,
  sourceHash: hash(['a', 'b', 'c', 'd', 'e', 'f'][index % 6]),
}));
const fullContract = (): PublicationContract => ({
  schemaVersion: 1,
  banks: Object.fromEntries(
    fullJobs.map((job) => [
      job.path,
      {
        sourceLocale: job.sourceLocale,
        sourceHash: job.sourceHash,
        translations: Object.fromEntries(
          targets(job.sourceLocale).map((locale) => [locale, { payloadHash: hash('c') }]),
        ),
      },
    ]),
  ),
});

test('publication contract requires an explicit full target set for a ready bank', () => {
  expect(() => assertPublicationContract(contract(), jobs, targets)).not.toThrow();
  const partial = contract();
  delete partial.banks['courses/ready.json'].translations.de;
  expect(() => assertPublicationContract(partial, jobs, targets)).toThrow('Published bank must declare');
});

test('publication contract rejects a tampered source or payload hash', () => {
  const sourceTampered = contract();
  sourceTampered.banks['courses/ready.json'].sourceHash = hash('d');
  expect(() => assertPublicationContract(sourceTampered, jobs, targets)).toThrow('source hash changed');
  const payloadTampered = contract();
  payloadTampered.banks['courses/ready.json'].translations.de = { payloadHash: 'tampered' };
  expect(() => assertPublicationContract(payloadTampered, jobs, targets)).toThrow(
    'invalid published payload hash',
  );
  expect(() => assertPublishedPayloadHash(hash('c'), hash('d'), 'fixture')).toThrow(
    'published contract payload changed',
  );
});

test('full validation cannot be narrowed by a publication contract', async () => {
  await expect(checkContentTranslations('full', contract())).rejects.toThrow(
    'Full content check cannot use a publication contract',
  );
});

test('full publication scope accepts exactly 42 banks with every target locale', () => {
  expect(() => assertFullPublicationScope(fullContract(), targets)).not.toThrow();
});

test('full publication scope rejects the former 26/16 partial split and wrong bank counts', () => {
  const partial = fullContract();
  const paths = Object.keys(partial.banks);
  for (const path of paths.slice(26)) partial.banks[path].translations = {};
  expect(() => assertFullPublicationScope(partial, targets)).toThrow('every target locale');

  const fortyOne = fullContract();
  delete fortyOne.banks[paths[41]];
  expect(() => assertFullPublicationScope(fortyOne, targets)).toThrow('exactly 42 banks');

  const fortyThree = fullContract();
  fortyThree.banks['courses/full-43.json'] = fortyThree.banks[paths[0]];
  expect(() => assertFullPublicationScope(fortyThree, targets)).toThrow('exactly 42 banks');
});

test('full publication scope rejects a missing locale, a missing Japanese target for English source, and an invalid locale', () => {
  const missing = fullContract();
  delete missing.banks[fullJobs[0].path].translations.de;
  expect(() => assertFullPublicationScope(missing, targets)).toThrow('every target locale');

  const english = fullContract();
  delete english.banks[fullJobs[41].path].translations.ja;
  expect(() => assertFullPublicationScope(english, targets)).toThrow('every target locale');

  const wrongLocale = fullContract();
  wrongLocale.banks[fullJobs[0].path].translations.ja = { payloadHash: hash('c') };
  expect(() => assertFullPublicationScope(wrongLocale, targets)).toThrow();
});

test('normal lint requires both full and published content gates', () => {
  expect(packageJson.scripts.lint).toContain('bun run i18n:content');
  expect(packageJson.scripts['i18n:content']).toBe(
    'bun run i18n:content:full && bun run i18n:content:published',
  );
});
