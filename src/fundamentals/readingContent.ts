import type { FundamentalsSection } from './types';

const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const texts = (value: unknown): value is string[] =>
  Array.isArray(value) && value.length > 0 && value.every(text);

function validSection(value: unknown): value is FundamentalsSection {
  if (!record(value)) return false;
  const { example, misconception, source } = value;
  return (
    text(value.id) &&
    text(value.title) &&
    texts(value.paragraphs) &&
    texts(value.takeaways) &&
    record(example) &&
    text(example.scenario) &&
    texts(example.steps) &&
    text(example.outcome) &&
    record(misconception) &&
    text(misconception.claim) &&
    text(misconception.correction) &&
    record(source) &&
    text(source.label) &&
    text(source.url) &&
    source.url.startsWith('https://')
  );
}

export function validReadingContent(unit: Record<string, unknown>) {
  const { sections, learningObjectives, questions } = unit;
  if (
    !Array.isArray(sections) ||
    sections.length !== 4 ||
    !sections.every(validSection) ||
    new Set(sections.map((section) => section.id)).size !== sections.length ||
    !Array.isArray(learningObjectives) ||
    learningObjectives.length !== 4 ||
    !Array.isArray(questions) ||
    questions.length !== 12 ||
    !questions.every(record)
  )
    return false;
  const objectives = learningObjectives.filter(record);
  if (
    objectives.length !== learningObjectives.length ||
    !objectives.every(
      (objective) =>
        text(objective.id) &&
        text(objective.text) &&
        texts(objective.sectionIds) &&
        objective.sectionIds.every((id) => sections.some((section) => section.id === id)),
    ) ||
    new Set(objectives.map((objective) => objective.id)).size !== objectives.length
  )
    return false;
  if (
    !sections.every((section) =>
      objectives.some(
        (objective) => texts(objective.sectionIds) && objective.sectionIds.includes(section.id),
      ),
    )
  )
    return false;
  if (
    !questions.every(
      (question) =>
        objectives.some(
          (objective) =>
            objective.id === question.objectiveId &&
            texts(objective.sectionIds) &&
            text(question.sectionId) &&
            objective.sectionIds.includes(question.sectionId),
        ) && ['recall', 'apply', 'integrate'].includes(String(question.application)),
    )
  )
    return false;
  for (const objective of objectives) {
    const applications = new Set(
      questions
        .filter((question) => question.objectiveId === objective.id)
        .map((question) => question.application),
    );
    if (!['recall', 'apply', 'integrate'].every((application) => applications.has(application)))
      return false;
  }
  const forms = new Map<string, number>();
  for (const question of questions) {
    const form = `${question.selectionPolarity}:${question.requiredChoices}`;
    forms.set(form, (forms.get(form) ?? 0) + 1);
  }
  return ['correct:1', 'incorrect:1', 'correct:2', 'incorrect:2'].every((form) => forms.get(form) === 3);
}
