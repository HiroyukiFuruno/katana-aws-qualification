import type { Question } from './questions';

export function questionTranslationSource(question: Question) {
  return {
    ...question,
    categoryLabel: question.category,
    examDomainLabel: question.examDomain ?? question.category,
    versionLabel: question.version,
    sourceLabel: question.source.label,
  };
}
