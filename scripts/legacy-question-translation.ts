import assert from 'node:assert/strict';
import { validateQuestionTranslation } from '../src/questionLocalization';
import type { Question } from '../src/questions';
import { translationKey } from '../src/questionTranslations';

type LegacyQuestion = Pick<Question, 'title' | 'prompt' | 'learning'> & {
  choices: Record<string, Pick<Question['choices'][number], 'text' | 'explanation'>>;
};

export function legacyQuestionTranslation(source: Question[], translated: Question[]) {
  const localized = validateQuestionTranslation(source, translated);
  const categories: Record<string, string> = {};
  const sourceLabels: Record<string, string> = {};
  const questions: Record<string, LegacyQuestion> = {};
  const addLabel = (map: Record<string, string>, key: string, value: string | undefined) => {
    assert(typeof value === 'string' && value.trim(), `Missing legacy translation label: ${key}`);
    map[key] ??= value;
  };
  for (const [index, base] of source.entries()) {
    const item = localized[index];
    addLabel(categories, base.category, item.categoryLabel);
    addLabel(sourceLabels, base.source.label, item.source.label);
    for (const [referenceIndex, reference] of (base.references ?? []).entries())
      addLabel(sourceLabels, reference.label, item.references?.[referenceIndex]?.label);
    const key = translationKey(base);
    assert(!Object.hasOwn(questions, key), `Duplicate legacy question identity: ${key}`);
    questions[key] = {
      title: item.title,
      prompt: item.prompt,
      ...(item.learning ? { learning: item.learning } : {}),
      choices: Object.fromEntries(
        item.choices.map(({ id, text, explanation }) => [id, { text, explanation }]),
      ),
    };
  }
  return { categories, sourceLabels, questions };
}
