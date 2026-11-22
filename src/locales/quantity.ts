import type { Locale } from '../locales';
import type { Message } from '../messages';
import quantityVariants from '../quantity-variants.json' with { type: 'json' };
import { quantityVariantRequirements } from './quantity-requirements.ts';
import { formParts, placeholders, samePlaceholders } from './quantity-validation-helpers.ts';

type QuantityValues = Record<string, string | number>;
type QuantityForm = `${string}:${string}`;

export type QuantityVariant = {
  operands: string[];
  forms: Record<QuantityForm, string>;
};

export type QuantityVariantData = Partial<Record<Locale, Partial<Record<Message, QuantityVariant>>>>;

export const quantityVariantData = quantityVariants as QuantityVariantData;

function requireQuantity(values: QuantityValues, key: Message, operand: string) {
  const value = values[operand];
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new TypeError(`${key} requires a finite numeric ${operand}`);
  return value;
}

function matchingForm(locale: Locale, variant: QuantityVariant, quantities: Record<string, number>) {
  const rules = new Intl.PluralRules(locale);
  return variant.operands
    .map(
      (operand) =>
        `${operand}:${quantities[operand] !== 0 && rules.select(quantities[operand]) === 'one' ? 'one' : 'other'}`,
    )
    .sort()
    .join('|') as QuantityForm;
}

function requiredOperands(key: Message) {
  if (!quantityVariantRequirements.keys.includes(key as never)) return [];
  return quantityVariantRequirements.operands[key as keyof typeof quantityVariantRequirements.operands];
}

export function formatQuantityMessage(
  locale: Locale,
  key: Message,
  template: string,
  values: QuantityValues,
) {
  for (const operand of requiredOperands(key)) requireQuantity(values, key, operand);
  const variant = quantityVariantData[locale]?.[key];
  if (!variant) return template;
  const quantities = Object.fromEntries(
    variant.operands.map((operand) => [operand, requireQuantity(values, key, operand)]),
  ) as Record<string, number>;
  const form = matchingForm(locale, variant, quantities);
  return form && Object.hasOwn(variant.forms, form) ? variant.forms[form] : template;
}

export function validateQuantityVariants(
  data: QuantityVariantData,
  dictionaries: Record<Locale, Record<Message, string>>,
) {
  const declaredLocales = [
    ...quantityVariantRequirements.inheritedLocales,
    ...quantityVariantRequirements.variantLocales,
  ].sort();
  if (JSON.stringify(declaredLocales) !== JSON.stringify(Object.keys(dictionaries).sort()))
    throw new Error('quantity locale policy differs from supported locales');
  for (const locale of quantityVariantRequirements.inheritedLocales)
    if (data[locale]) throw new Error(`quantity locale must inherit base: ${locale}`);
  for (const locale of quantityVariantRequirements.variantLocales) {
    const entries = data[locale];
    if (!entries) throw new Error(`missing quantity locale: ${locale}`);
  }
  for (const locale of quantityVariantRequirements.variantLocales) {
    const entries = data[locale];
    if (!entries) throw new Error(`missing quantity locale: ${locale}`);
    for (const key of quantityVariantRequirements.keys)
      if (!entries[key]) throw new Error(`missing quantity variant: ${locale}.${key}`);
    const actualKeys = Object.keys(entries).sort();
    const expectedKeys = [...quantityVariantRequirements.keys].sort();
    if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
      const unexpected = actualKeys.find(
        (key) => !expectedKeys.includes(key as (typeof expectedKeys)[number]),
      );
      if (unexpected) throw new Error(`unexpected quantity variant: ${locale}.${unexpected}`);
      throw new Error(`quantity variant keys differ: ${locale}`);
    }
    for (const key of quantityVariantRequirements.keys) {
      const variant = entries[key];
      if (!variant) throw new Error(`missing quantity variant: ${locale}.${key}`);
      const expectedForms = [...quantityVariantRequirements.forms[key]].sort();
      for (const form of expectedForms)
        if (!Object.hasOwn(variant.forms, form))
          throw new Error(`missing quantity form: ${locale}.${key}.${form}`);
      const actualForms = Object.keys(variant.forms).sort();
      if (JSON.stringify(actualForms) !== JSON.stringify(expectedForms))
        throw new Error(`unexpected quantity form: ${locale}.${key}`);
    }
  }
  for (const [locale, entries] of Object.entries(data)) {
    if (!Object.hasOwn(dictionaries, locale)) throw new Error(`unknown quantity locale: ${locale}`);
    for (const [key, variant] of Object.entries(entries ?? {})) {
      if (!Object.hasOwn(dictionaries[locale as Locale], key))
        throw new Error(`unknown quantity message: ${locale}.${key}`);
      if (!Array.isArray(variant.operands) || !variant.operands.length)
        throw new Error(`missing quantity operands: ${locale}.${key}`);
      if (!variant.forms || !Object.keys(variant.forms).length)
        throw new Error(`missing quantity forms: ${locale}.${key}`);
      const template = dictionaries[locale as Locale][key as Message];
      const expectedOperands =
        quantityVariantRequirements.operands[key as keyof typeof quantityVariantRequirements.operands];
      if (JSON.stringify(variant.operands) !== JSON.stringify(expectedOperands))
        throw new Error(`quantity operands differ: ${locale}.${key}`);
      for (const operand of variant.operands)
        if (!placeholders(template).includes(operand))
          throw new Error(`unknown quantity operand: ${locale}.${key}.${operand}`);
      for (const [form, value] of Object.entries(variant.forms ?? {})) {
        if (!value.trim()) throw new Error(`empty quantity form: ${locale}.${key}.${form}`);
        const parts = formParts(form);
        const names = parts.map(([operand]) => operand);
        const categories = parts.map(([, category]) => category);
        const canonical = [...parts]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([operand, category]) => `${operand}:${category}`)
          .join('|');
        const localeCategories = new Set(
          new Intl.PluralRules(locale).resolvedOptions().pluralCategories,
        );
        if (
          parts.length !== variant.operands.length ||
          new Set(names).size !== names.length ||
          form !== canonical ||
          parts.some(
            ([operand, category]) =>
              !variant.operands.includes(operand) ||
              (!localeCategories.has(category as Intl.LDMLPluralRule) &&
                !/^[-]?\d+(?:\.\d+)?$/.test(category)),
          ) ||
          (categories.some((category) => /^[-]?\d+(?:\.\d+)?$/.test(category)) &&
            !categories.every((category) => /^[-]?\d+(?:\.\d+)?$/.test(category)))
        )
          throw new Error(`invalid quantity form: ${locale}.${key}.${form}`);
        if (!samePlaceholders(template, value))
          throw new Error(`quantity placeholders differ: ${locale}.${key}.${form}`);
      }
    }
  }
}
