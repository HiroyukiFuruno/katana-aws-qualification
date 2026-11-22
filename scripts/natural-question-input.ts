import type { Locale } from '../src/locales';
import type { Question } from '../src/questions';
import { questionTranslationSource } from './natural-translation-content';
import { translationIdentifiers } from './translation-identifiers';

const visibleFields = new Set([
  'title',
  'prompt',
  'choices',
  'learning',
  'prompts',
  'references',
  'categoryLabel',
  'examDomainLabel',
  'versionLabel',
  'sourceLabel',
]);
function identifierFields(
  value: unknown,
  path: (string | number)[] = [],
): { path: (string | number)[]; tokens: string[] }[] {
  if (typeof value === 'string') {
    const tokens = translationIdentifiers(value);
    return tokens.length ? [{ path, tokens }] : [];
  }
  if (Array.isArray(value))
    return value.flatMap((item, index) => identifierFields(item, [...path, index]));
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, item]) => identifierFields(item, [...path, key]));
}

export function naturalQuestionInput(
  questions: Question[],
  sourceLocale: string,
  targetLocales: Locale[],
  reviewOnly: boolean,
  validationFeedback?: string,
) {
  return {
    sourceLocale,
    validationFeedback,
    targetLocales: reviewOnly ? [] : targetLocales,
    identifiersByQuestion: reviewOnly
      ? []
      : questions.map((question) => ({
          id: question.id,
          fields: identifierFields(
            Object.fromEntries(
              Object.entries(questionTranslationSource(question)).filter(([key]) =>
                visibleFields.has(key),
              ),
            ),
          ),
        })),
    questions: questions.map((question) => ({ ...question, references: question.references ?? null })),
  };
}
