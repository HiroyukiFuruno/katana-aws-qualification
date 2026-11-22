import type { Locale } from '../../locales';
import type { DeliveryIndexAsset, DeliveryQuestion, DeliveryUnitAsset } from './artifactTypes';
import type { LessonStep } from './slideTypes';

const translated = (locale: Locale) => locale !== 'ja';

export function translatedDeliveryPath(locale: Locale, sourcePath: string) {
  return `/translations/${locale}${sourcePath}`;
}

function same(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function questionIdentity(question: DeliveryQuestion) {
  return {
    ...question,
    choices: question.choices.map(({ explanation, text, ...choice }) => choice),
    source: { url: question.source.url },
    title: undefined,
    prompt: undefined,
  };
}

function overlayQuestion(base: DeliveryQuestion, locale: DeliveryQuestion): DeliveryQuestion {
  if (!same(questionIdentity(base), questionIdentity(locale)))
    throw new Error(`Localized lesson question identity changed: ${base.id}`);
  return {
    ...base,
    prompt: locale.prompt,
    source: { ...base.source, label: locale.source.label },
    title: locale.title,
    choices: base.choices.map((choice, index) => {
      const localized = locale.choices[index];
      if (!localized) throw new Error(`Localized lesson choice is missing: ${base.id}`);
      return { ...choice, explanation: localized.explanation, text: localized.text };
    }),
  };
}

function stepIdentity(step: LessonStep) {
  return {
    ...step,
    blocks: step.blocks.map(({ label, text, ...block }) => block),
    label: undefined,
    sources: step.sources.map((source) => ({ url: source.url })),
  };
}

function overlayStep(base: LessonStep, locale: LessonStep): LessonStep {
  if (!same(stepIdentity(base), stepIdentity(locale)))
    throw new Error(`Localized lesson slide identity changed: ${base.id}`);
  return {
    ...base,
    label: locale.label,
    blocks: base.blocks.map((block, index) => {
      const localized = locale.blocks[index];
      if (!localized) throw new Error(`Localized lesson block is missing: ${base.id}`);
      return { ...block, label: localized.label, text: localized.text };
    }),
    sources: base.sources.map((source, index) => {
      const localized = locale.sources[index];
      if (!localized) throw new Error(`Localized lesson source is missing: ${base.id}`);
      return { ...source, label: localized.label };
    }),
  };
}

function indexIdentity(unit: DeliveryIndexAsset['units'][number]) {
  const { objective, parent, title, ...identity } = unit;
  return identity;
}

export function overlayDeliveryIndex(base: DeliveryIndexAsset, locale: DeliveryIndexAsset) {
  if (base.units.length !== locale.units.length) throw new Error('Localized lesson index changed.');
  return {
    ...base,
    units: base.units.map((unit, index) => {
      const localized = locale.units[index];
      if (!localized || !same(indexIdentity(unit), indexIdentity(localized)))
        throw new Error(`Localized lesson index identity changed: ${unit.unitId}`);
      return {
        ...unit,
        objective: localized.objective,
        parent: localized.parent,
        title: localized.title,
      };
    }),
  };
}

export function overlayDeliveryUnit(base: DeliveryUnitAsset, locale: DeliveryUnitAsset) {
  if (
    base.unit.id !== locale.unit.id ||
    base.contentVersion !== locale.contentVersion ||
    base.contentHash !== locale.contentHash ||
    !same(base.finalPolicy, locale.finalPolicy) ||
    base.steps.length !== locale.steps.length ||
    base.checkpoints.length !== locale.checkpoints.length ||
    base.finalQuestions.length !== locale.finalQuestions.length
  ) {
    throw new Error(`Localized lesson identity changed: ${base.unit.id}`);
  }
  return {
    ...base,
    unit: { ...base.unit, title: locale.unit.title },
    steps: base.steps.map((step, index) => {
      const localized = locale.steps[index];
      if (!localized) throw new Error(`Localized lesson step is missing: ${base.unit.id}`);
      return overlayStep(step, localized);
    }),
    checkpoints: base.checkpoints.map((question, index) => {
      const localized = locale.checkpoints[index];
      if (!localized) throw new Error(`Localized lesson checkpoint is missing: ${base.unit.id}`);
      return overlayQuestion(question, localized);
    }),
    finalQuestions: base.finalQuestions.map((question, index) => {
      const localized = locale.finalQuestions[index];
      if (!localized) throw new Error(`Localized lesson final is missing: ${base.unit.id}`);
      return overlayQuestion(question, localized);
    }),
  };
}

export function needsTranslatedDelivery(locale: Locale) {
  return translated(locale);
}
