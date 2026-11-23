import assert from 'node:assert/strict';
import type { Locale } from '../src/locales';

export type PublishedTranslation = { payloadHash: string };
export type PublishedBank = {
  sourceLocale: Locale;
  sourceHash: string;
  translations: Partial<Record<Locale, PublishedTranslation>>;
};
export type PublicationContract = {
  schemaVersion: 1;
  banks: Record<string, PublishedBank>;
};
export type PublicationJob = { path: string; sourceLocale: Locale; sourceHash: string };

const hash = /^[a-f0-9]{64}$/;

export function assertPublishedPayloadHash(actual: string, expected: string, context: string) {
  assert.equal(actual, expected, `${context}: published contract payload changed`);
}

export function publishedLocales(bank: PublishedBank, targetLocales: readonly Locale[]) {
  const locales = Object.keys(bank.translations) as Locale[];
  assert(
    locales.length === 0 || locales.length === targetLocales.length,
    'Published bank must declare every target locale or source-only delivery',
  );
  if (locales.length)
    assert.deepEqual([...locales].sort(), [...targetLocales].sort(), 'Published target locales differ');
  return locales;
}

export function assertPublicationContract(
  contract: PublicationContract,
  jobs: readonly PublicationJob[],
  targetsFor: (sourceLocale: Locale) => readonly Locale[],
) {
  assert.equal(contract.schemaVersion, 1, 'Unsupported publication contract schema');
  assert.deepEqual(
    Object.keys(contract.banks).sort(),
    jobs.map((job) => job.path).sort(),
    'Published banks differ',
  );
  for (const job of jobs) {
    const bank = contract.banks[job.path];
    assert(bank, `${job.path}: missing published bank declaration`);
    assert.deepEqual(
      Object.keys(bank).sort(),
      ['sourceHash', 'sourceLocale', 'translations'],
      `${job.path}: invalid published bank shape`,
    );
    assert.equal(bank.sourceLocale, job.sourceLocale, `${job.path}: published source locale changed`);
    assert.equal(bank.sourceHash, job.sourceHash, `${job.path}: published source hash changed`);
    assert(hash.test(bank.sourceHash), `${job.path}: invalid published source hash`);
    for (const locale of publishedLocales(bank, targetsFor(job.sourceLocale))) {
      const translation = bank.translations[locale];
      assert.deepEqual(
        Object.keys(translation ?? {}).sort(),
        ['payloadHash'],
        `${job.path}/${locale}: invalid published translation shape`,
      );
      const payloadHash = translation?.payloadHash;
      assert(hash.test(payloadHash ?? ''), `${job.path}/${locale}: invalid published payload hash`);
    }
  }
}

export function assertFullPublicationScope(
  contract: PublicationContract,
  targetsFor: (sourceLocale: Locale) => readonly Locale[],
) {
  assert.equal(Object.keys(contract.banks).length, 42, 'Full publication must contain exactly 42 banks');
  for (const [path, bank] of Object.entries(contract.banks)) {
    const targetLocales = targetsFor(bank.sourceLocale);
    const locales = publishedLocales(bank, targetLocales);
    assert.equal(
      locales.length,
      targetLocales.length,
      `${path}: full publication must declare every target locale`,
    );
  }
}
