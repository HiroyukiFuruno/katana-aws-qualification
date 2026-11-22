import type { Locale } from './locales';
import { questionPayloadHash, verifyQuestionPayloads } from './questionPayloadIntegrity';
import { loadPublishedQuestionContent } from './questionPublication';
import { sourceLocaleOf } from './questionSourceLocale';
import { parseQuestions, type Question } from './questions';
import { questionTranslationSource } from './questionTranslationSource';

const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

function sameQuestionIdentity(canonical: Question, translated: Question) {
  return (
    canonical.id === translated.id &&
    canonical.revision === translated.revision &&
    canonical.category === translated.category &&
    canonical.examDomain === translated.examDomain &&
    canonical.similarityGroup === translated.similarityGroup &&
    canonical.version === translated.version &&
    canonical.format === translated.format &&
    (canonical.references?.length ?? 0) === (translated.references?.length ?? 0) &&
    (canonical.references ?? []).every(
      (reference, index) => reference.url === translated.references?.[index]?.url,
    ) &&
    canonical.correct.length === translated.correct.length &&
    canonical.correct.every((id, index) => id === translated.correct[index]) &&
    canonical.choices.length === translated.choices.length &&
    canonical.choices.every((choice, index) => choice.id === translated.choices[index]?.id) &&
    ((canonical.prompts === undefined && translated.prompts === undefined) ||
      (canonical.prompts !== undefined &&
        canonical.prompts.length === translated.prompts?.length &&
        canonical.prompts.every((prompt, index) => prompt.id === translated.prompts?.[index]?.id)))
  );
}

export function validateQuestionTranslation(canonical: Question[], translated: unknown): Question[] {
  const localized = parseQuestions(translated);
  if (
    canonical.length !== localized.length ||
    localized.some(
      (question) =>
        ![
          question.categoryLabel,
          question.examDomainLabel,
          question.versionLabel,
          question.sourceLabel,
        ].every(text),
    ) ||
    canonical.some((item, index) => !sameQuestionIdentity(item, localized[index]))
  ) {
    throw new Error('invalidQuestionData');
  }
  return localized.map((question, index) => ({
    ...question,
    source: { ...canonical[index].source, label: question.sourceLabel as string },
  }));
}

async function loadQuestionFile(filename: string, fetcher: typeof fetch): Promise<unknown> {
  const response = await fetcher(`/${filename}`, { cache: 'no-cache' });
  if (!response.ok) throw new Error('loadQuestionError');
  return response.json();
}

function withContentLocale(questions: Question[], locale: Locale): Question[] {
  return questions.map((question) => ({ ...question, locale }));
}

export type LoadedQuestionBank = {
  questions: Question[];
  contentLocale: Locale;
  pendingLocale?: Locale;
};

export async function loadQuestionBank(
  filename: string,
  locale: Locale = 'ja',
  fetcher: typeof fetch = fetch,
): Promise<LoadedQuestionBank> {
  const source = await loadQuestionFile(filename, fetcher);
  const canonical = parseQuestions(source);
  const sourceLocale = sourceLocaleOf(filename);
  if (locale === sourceLocale) {
    return { questions: withContentLocale(canonical, sourceLocale), contentLocale: sourceLocale };
  }
  const publication = await loadPublishedQuestionContent(fetcher);
  const bank = publication.banks[filename];
  if (!bank || bank.sourceLocale !== sourceLocale) throw new Error('invalidQuestionData');
  const sourceHash = await questionPayloadHash(canonical.map(questionTranslationSource));
  if (sourceHash !== bank.sourceHash) throw new Error('invalidQuestionData');
  const authorized = bank.translations[locale];
  if (!authorized) {
    return {
      questions: withContentLocale(canonical, sourceLocale),
      contentLocale: sourceLocale,
      pendingLocale: locale,
    };
  }
  const [translated, sourceManifest, payloadManifest] = await Promise.all([
    loadQuestionFile(`translations/${locale}/${filename}`, fetcher),
    loadQuestionFile(`translations/${locale}/manifest.json`, fetcher),
    loadQuestionFile(`translations/${locale}/payload-manifest.json`, fetcher),
  ]);
  await verifyQuestionPayloads(filename, canonical, translated, sourceManifest, payloadManifest);
  if ((await questionPayloadHash(translated)) !== authorized.payloadHash) {
    throw new Error('invalidQuestionData');
  }
  return {
    questions: withContentLocale(validateQuestionTranslation(canonical, translated), locale),
    contentLocale: locale,
  };
}

export async function loadQuestions(
  filename: string,
  locale: Locale = 'ja',
  fetcher: typeof fetch = fetch,
): Promise<Question[]> {
  return (await loadQuestionBank(filename, locale, fetcher)).questions;
}
