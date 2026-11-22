import { type Locale, locales } from './locales';

const publicationPath = 'translations/published-content.v1.json';
const hash = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const knownLocale = (value: unknown): value is Locale =>
  typeof value === 'string' && locales.some((locale) => locale === value);

export type PublishedQuestionTranslation = { payloadHash: string };
export type PublishedQuestionBank = {
  sourceLocale: Locale;
  sourceHash: string;
  translations: Partial<Record<Locale, PublishedQuestionTranslation>>;
};
export type PublishedQuestionContent = { banks: Record<string, PublishedQuestionBank> };

function invalid(): never {
  throw new Error('invalidQuestionData');
}

function publicationLocale(value: unknown): Locale {
  if (knownLocale(value)) return value;
  return invalid();
}

function parseBank(value: unknown): PublishedQuestionBank {
  if (!record(value) || !hash(value.sourceHash) || !record(value.translations)) return invalid();
  const translations: Partial<Record<Locale, PublishedQuestionTranslation>> = {};
  for (const [locale, translation] of Object.entries(value.translations)) {
    if (!record(translation) || !hash(translation.payloadHash)) return invalid();
    translations[publicationLocale(locale)] = { payloadHash: translation.payloadHash };
  }
  return {
    sourceLocale: publicationLocale(value.sourceLocale),
    sourceHash: value.sourceHash,
    translations,
  };
}

export function parsePublishedQuestionContent(value: unknown): PublishedQuestionContent {
  if (!record(value) || value.schemaVersion !== 1 || !record(value.banks)) return invalid();
  return {
    banks: Object.fromEntries(
      Object.entries(value.banks).map(([path, bank]) => [path, parseBank(bank)]),
    ),
  };
}

export async function loadPublishedQuestionContent(fetcher: typeof fetch = fetch) {
  const response = await fetcher(`/${publicationPath}`, { cache: 'no-cache' });
  if (!response.ok) throw new Error('loadQuestionError');
  return parsePublishedQuestionContent(await response.json());
}
