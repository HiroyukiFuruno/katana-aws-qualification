import { expect, test } from 'bun:test';
import { parseQuestions } from '../src/questions';
import { applyQuestionTranslation } from '../src/questionTranslations';
import { legacyQuestionTranslation } from './legacy-question-translation';

const path = 'courses/dva-c02/mock-2026-11.json';
const source = parseQuestions(await Bun.file(`public/${path}`).json()).slice(0, 2);
const localized = parseQuestions(await Bun.file(`public/translations/fr/${path}`).json()).slice(0, 2);
source[0].references = [{ url: source[0].source.url, label: '補足資料' }];
localized[0].references = [{ url: source[0].source.url, label: 'Documentation complémentaire' }];

test('new translations remain readable by the legacy consumer without changing grades or references', () => {
  const legacy = legacyQuestionTranslation(source, localized);
  const restored = applyQuestionTranslation(source, 'fr', legacy);
  for (const [index, item] of restored.entries()) {
    expect(item.id).toBe(source[index].id);
    expect(item.revision).toBe(source[index].revision);
    expect(item.correct).toEqual(source[index].correct);
    expect(item.choices).toEqual(localized[index].choices);
    expect(item.prompt).toBe(localized[index].prompt);
    expect(item.learning).toEqual(localized[index].learning);
    expect(item.source).toEqual({
      url: source[index].source.url,
      label: localized[index].sourceLabel,
    });
    expect(item.references).toEqual(localized[index].references);
    expect(item.references?.map(({ url }) => url)).toEqual(
      source[index].references?.map(({ url }) => url),
    );
  }
});

test('legacy export rejects changed canonical choice order and repeated question identities', () => {
  const changed = structuredClone(localized);
  changed[0].choices.reverse();
  expect(() => legacyQuestionTranslation(source, changed)).toThrow('invalidQuestionData');
  expect(() => legacyQuestionTranslation([source[0], source[0]], [localized[0], localized[0]])).toThrow(
    'invalidQuestionData',
  );
});
