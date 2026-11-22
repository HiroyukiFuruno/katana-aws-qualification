import { expect, test } from 'bun:test';
import type { Locale } from '../src/locales';
import { checkContentTranslations } from './check-content-translations';
import {
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
