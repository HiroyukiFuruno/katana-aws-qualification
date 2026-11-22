import { expect, test } from 'bun:test';
import { naturalQuestionHash, questionTranslationSource } from './natural-translation-content';
import { canonical } from './question-localization-fixture';

test('raw and expanded canonical questions share the same translation provenance hash', () => {
  const source = canonical[0];
  const expanded = questionTranslationSource(source);
  expect(naturalQuestionHash(source)).toBe(naturalQuestionHash(expanded));
  expect(naturalQuestionHash(source, 'en')).toBe(naturalQuestionHash(expanded, 'en'));
  expect(naturalQuestionHash(source, 'en')).not.toBe(naturalQuestionHash(source, 'ja'));
  expect(naturalQuestionHash({ ...source, prompt: `${source.prompt} revised` })).not.toBe(
    naturalQuestionHash(source),
  );
});
