import type { FundamentalsContent, FundamentalsQuestion, FundamentalsUnit } from './types';

function same(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function questionIdentity(question: FundamentalsQuestion) {
  return {
    ...question,
    choices: question.choices.map(({ explanation, text, ...choice }) => choice),
    learning: undefined,
    prompt: undefined,
    references: question.references?.map(({ url }) => ({ url })),
    source: { url: question.source.url },
    title: undefined,
  };
}

function overlayQuestion(base: FundamentalsQuestion, locale: FundamentalsQuestion) {
  if (!same(questionIdentity(base), questionIdentity(locale)))
    throw new Error(`Localized fundamentals question identity changed: ${base.id}`);
  return {
    ...base,
    learning: locale.learning,
    prompt: locale.prompt,
    references: locale.references,
    source: { ...base.source, label: locale.source.label },
    title: locale.title,
    choices: base.choices.map((choice, index) => {
      const localized = locale.choices[index];
      if (!localized) throw new Error(`Localized fundamentals choice is missing: ${base.id}`);
      return { ...choice, explanation: localized.explanation, text: localized.text };
    }),
  } as FundamentalsQuestion;
}

function overlayUnit(base: FundamentalsUnit, locale: FundamentalsUnit): FundamentalsUnit {
  if (
    base.id !== locale.id ||
    base.order !== locale.order ||
    !same(base.prerequisites, locale.prerequisites) ||
    base.next !== locale.next ||
    base.questions.length !== locale.questions.length
  ) {
    throw new Error(`Localized fundamentals unit identity changed: ${base.id}`);
  }
  const objectives = base.learningObjectives?.map((objective, index) => {
    const localized = locale.learningObjectives?.[index];
    if (!localized || objective.id !== localized.id || !same(objective.sectionIds, localized.sectionIds))
      throw new Error(`Localized fundamentals objective identity changed: ${base.id}`);
    return { ...objective, text: localized.text };
  });
  const sections = base.sections?.map((section, index) => {
    const localized = locale.sections?.[index];
    if (!localized || section.id !== localized.id || section.source.url !== localized.source.url)
      throw new Error(`Localized fundamentals section identity changed: ${base.id}`);
    return {
      ...localized,
      id: section.id,
      source: { ...section.source, label: localized.source.label },
    };
  });
  return {
    ...base,
    example: locale.example,
    explanation: locale.explanation,
    learningObjectives: objectives,
    objective: locale.objective,
    questions: base.questions.map((question, index) => {
      const localized = locale.questions[index];
      if (!localized) throw new Error(`Localized fundamentals question is missing: ${base.id}`);
      return overlayQuestion(question, localized);
    }),
    sections,
    summary: locale.summary,
    title: locale.title,
  };
}

export function overlayFundamentalsContent(base: FundamentalsContent, locale: FundamentalsContent) {
  if (base.catalog.length !== locale.catalog.length || base.units.length !== locale.units.length)
    throw new Error('Localized fundamentals content changed.');
  return {
    catalog: base.catalog.map((item, index) => {
      const localized = locale.catalog[index];
      if (
        !localized ||
        item.id !== localized.id ||
        item.order !== localized.order ||
        item.parent !== localized.parent ||
        item.state !== localized.state ||
        !same(item.prerequisiteIds, localized.prerequisiteIds)
      ) {
        throw new Error(`Localized fundamentals catalog identity changed: ${item.id}`);
      }
      return { ...item, objective: localized.objective, title: localized.title };
    }),
    units: base.units.map((unit, index) => {
      const localized = locale.units[index];
      if (!localized) throw new Error(`Localized fundamentals unit is missing: ${unit.id}`);
      return overlayUnit(unit, localized);
    }),
  };
}
