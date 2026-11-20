import { parseQuestions } from '../questions';
import { moduleLabels } from './moduleLabels';
import { validReadingContent } from './readingContent';
import type { FundamentalsContent } from './types';

const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object';

export function validFundamentalsContent(value: unknown): value is FundamentalsContent {
  if (!record(value) || !Array.isArray(value.catalog) || !Array.isArray(value.units)) return false;
  const catalog = value.catalog;
  const catalogIds = new Set(
    catalog.flatMap((item: unknown) => (record(item) && text(item.id) ? [item.id] : [])),
  );
  if (
    catalog.length !== 12 ||
    catalogIds.size !== catalog.length ||
    !catalog.every((item: unknown) => {
      if (!record(item)) return false;
      const state = item.state;
      return (
        text(item.id) &&
        catalogIds.has(item.id) &&
        Number.isSafeInteger(item.order) &&
        text(item.parent) &&
        Object.hasOwn(moduleLabels, item.parent) &&
        Array.isArray(item.prerequisiteIds) &&
        text(item.title) &&
        text(item.objective) &&
        (state === 'published' || state === 'planned') &&
        item.prerequisiteIds.every((id): id is string => text(id) && catalogIds.has(id))
      );
    })
  )
    return false;
  const units = value.units;
  const publishedIds = new Set(
    catalog.filter((item) => item.state === 'published').map((item) => item.id),
  );
  const plannedIds = new Set(catalog.filter((item) => item.state === 'planned').map((item) => item.id));
  if (
    publishedIds.size !== catalog.length ||
    plannedIds.size !== 0 ||
    units.length !== publishedIds.size
  )
    return false;
  const unitIds = new Set<string>();
  const questionIds = new Set<string>();
  return units.every((unit: unknown) => {
    if (!record(unit)) return false;
    if (!validReadingContent(unit)) return false;
    const questions = unit.questions;
    return (
      text(unit.id) &&
      publishedIds.has(unit.id) &&
      !unitIds.has(unit.id) &&
      Number.isSafeInteger(unit.order) &&
      text(unit.title) &&
      text(unit.summary) &&
      Array.isArray(unit.prerequisites) &&
      Array.isArray(unit.explanation) &&
      text(unit.objective) &&
      text(unit.example) &&
      Array.isArray(questions) &&
      questions.length >= 2 &&
      questions.every((question: unknown) => {
        if (!record(question)) return false;
        const polarity = question.selectionPolarity;
        const required = question.requiredChoices;
        return (
          text(question.unitId) &&
          question.unitId === unit.id &&
          text(question.id) &&
          !questionIds.has(question.id) &&
          Number.isSafeInteger(question.revision) &&
          (polarity === 'correct' || polarity === 'incorrect') &&
          typeof required === 'number' &&
          Number.isSafeInteger(required) &&
          required > 0 &&
          Array.isArray(question.choices) &&
          Array.isArray(question.correct) &&
          required === question.correct.length &&
          Boolean(question.source) &&
          Boolean(question.learning)
        );
      }) &&
      (() => {
        try {
          parseQuestions(questions);
          for (const question of questions) questionIds.add(String(question.id));
          const catalogItem = catalog.find((item) => item.id === unit.id);
          if (!catalogItem) return false;
          unitIds.add(unit.id);
          const next = unit.next;
          return (
            catalogItem.prerequisiteIds.every((id: unknown) => text(id) && catalogIds.has(id)) &&
            (!next || (text(next) && catalogIds.has(next))) &&
            (!next || (text(next) && (publishedIds.has(next) || plannedIds.has(next))))
          );
        } catch {
          return false;
        }
      })()
    );
  });
}
