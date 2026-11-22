import assert from 'node:assert/strict';
import type { Locale } from '../src/locales';
import type { Question } from '../src/questions';
import { mergeNaturalQuestion } from './natural-translation-content';

export function validateNaturalQuestionBatch(
  source: Question[],
  value: unknown,
  locales: readonly Locale[],
) {
  assert(value && typeof value === 'object' && !Array.isArray(value), 'Missing translation locales');
  const translated = value as Record<string, unknown>;
  const errors: string[] = [];
  for (const locale of locales) {
    const entries = translated[locale];
    if (!Array.isArray(entries) || entries.length !== source.length) {
      errors.push(`${locale}: natural translation changed batch length`);
      continue;
    }
    for (const [index, question] of source.entries()) {
      try {
        const entry: unknown = entries[index];
        assert(
          entry && typeof entry === 'object' && !Array.isArray(entry),
          `${question.id}/${locale}: missing translation`,
        );
        mergeNaturalQuestion(question, entry as Record<string, unknown>, locale);
      } catch (error) {
        errors.push(String(error));
      }
    }
  }
  if (errors.length) throw new Error(`Natural translation batch failed:\n${errors.join('\n')}`);
}
