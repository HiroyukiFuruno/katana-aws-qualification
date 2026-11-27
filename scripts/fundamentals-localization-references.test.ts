import { expect, test } from 'bun:test';
import { overlayFundamentalsContent } from '../src/fundamentals/contentLocalization';
import type { FundamentalsContent } from '../src/fundamentals/types';

const content: FundamentalsContent = await Bun.file('public/fundamentals/content.json').json();
const withReference = () => {
  const base = structuredClone(content);
  const [unit] = base.units;
  const [question] = unit.questions;
  const source = unit.sections?.find(({ source }) => source.url !== question.source.url)?.source;
  if (!source) throw new Error('Missing independent lesson reference.');
  question.references = [{ ...source }];
  const localized = structuredClone(base);
  const translated = localized.units[0].questions[0];
  return { base, localized, question: translated, references: translated.references ?? [] };
};

test('fundamentals references translate labels while preserving canonical URLs', () => {
  const { base, localized, question, references } = withReference();
  references[0].label = 'Documentation de référence';
  const result = overlayFundamentalsContent(base, localized);
  const translated = result.units
    .flatMap((unit) => unit.questions)
    .find((item) => item.id === question.id);
  expect(translated?.references).toEqual(references);
});

test('fundamentals reference localization rejects changed URLs and missing references', () => {
  const { base, localized, question, references } = withReference();
  references[0].url = 'https://example.com/changed';
  expect(() => overlayFundamentalsContent(base, localized)).toThrow('identity changed');
  question.references = undefined;
  expect(() => overlayFundamentalsContent(base, localized)).toThrow('identity changed');
});
