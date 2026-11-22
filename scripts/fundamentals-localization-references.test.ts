import { expect, test } from 'bun:test';
import { overlayFundamentalsContent } from '../src/fundamentals/contentLocalization';
import type { FundamentalsContent } from '../src/fundamentals/types';

const content: FundamentalsContent = await Bun.file('public/fundamentals/content.json').json();
const withReference = () => {
  const localized = structuredClone(content);
  const question = localized.units
    .flatMap((unit) => unit.questions)
    .find((item) => item.references?.length);
  if (!question?.references?.length) throw new Error('Missing real reference fixture.');
  return { localized, question, references: question.references };
};

test('fundamentals references translate labels while preserving canonical URLs', () => {
  const { localized, question, references } = withReference();
  references[0].label = 'Documentation de référence';
  const result = overlayFundamentalsContent(content, localized);
  const translated = result.units
    .flatMap((unit) => unit.questions)
    .find((item) => item.id === question.id);
  expect(translated?.references).toEqual(references);
});

test('fundamentals reference localization rejects changed URLs and missing references', () => {
  const { localized, question, references } = withReference();
  references[0].url = 'https://example.com/changed';
  expect(() => overlayFundamentalsContent(content, localized)).toThrow('identity changed');
  question.references = undefined;
  expect(() => overlayFundamentalsContent(content, localized)).toThrow('identity changed');
});
