import assert from 'node:assert/strict';
import type { Locale } from '../src/locales';
import { assertNativeLanguage } from './content-language-issues';
import { translationIdentifiers } from './translation-identifiers';
import { changedTranslationNumbers } from './translation-numbers';

type Json = string | number | boolean | null | Json[] | { [key: string]: Json | undefined };
const canonicalKeys = new Set([
  'id',
  'revision',
  'correct',
  'category',
  'examDomain',
  'version',
  'similarityGroup',
  'url',
  'path',
  'skill',
  'term',
  'expansion',
  'source',
  'tags',
  'format',
  'difficulty',
]);
const kana = /[\p{Script=Hiragana}\p{Script=Katakana}]/u;
const han = /\p{Script=Han}/u;
const proseKeys = new Set(['prompt', 'text', 'explanation', 'reason', 'concept', 'answer']);

export function assertDistinctChoices(value: unknown, locale: Locale, context: string) {
  assert(Array.isArray(value), `${context}: invalid choices`);
  const labels = value.map((choice) => {
    assert(
      choice && typeof choice === 'object' && typeof choice.text === 'string',
      `${context}: invalid choice`,
    );
    return choice.text.normalize('NFKC').trim().toLocaleLowerCase(locale);
  });
  assert.equal(
    new Set(labels).size,
    labels.length,
    `${context}: translations collapsed distinct choices`,
  );
}

export function validateTranslation(
  source: Json | undefined,
  translated: Json | undefined,
  locale: Locale,
  context: string,
  key = '',
) {
  if (canonicalKeys.has(key)) {
    assert.deepEqual(translated, source, `${context}: canonical identity changed`);
    return;
  }
  if (typeof source === 'string') {
    assert(typeof translated === 'string' && translated.trim(), `${context}: missing text`);
    assertNativeLanguage(source, translated, locale, context);
    assert(!/[\ufffd\u200b]/u.test(translated), `${context}: corrupt text`);
    assert(
      ![...translated].some(
        (character) => character.charCodeAt(0) < 32 && !'\t\n\r'.includes(character),
      ),
      `${context}: invalid control character`,
    );
    for (const sequence of translated.match(/\\(?:x[0-9a-f]{2}|u[0-9a-f]{4})/gi) ?? [])
      assert(source.includes(sequence), `${context}: generated escape artifact`);
    if (locale !== 'ja') {
      assert(!kana.test(translated), `${context}: untranslated Japanese`);
      if (!locale.startsWith('zh')) assert(!han.test(translated), `${context}: unexpected CJK text`);
    }
    if (
      locale !== 'en' &&
      proseKeys.has(key) &&
      !kana.test(source) &&
      !han.test(source) &&
      !source.trim().startsWith('`') &&
      source.trim().split(/\s+/u).length >= 8 &&
      (source.match(/\b[a-z]{3,}\b/gu)?.length ?? 0) >= 5
    )
      assert.notEqual(translated.trim(), source.trim(), `${context}: untranslated English prose`);
    if (proseKeys.has(key))
      assert.deepEqual(
        changedTranslationNumbers(source, translated, locale),
        [],
        `${context}: numeric quantity changed`,
      );
    for (const token of translationIdentifiers(source))
      assert(translated.includes(token), `${context}: technical token lost: ${token}`);
    return;
  }
  if (Array.isArray(source)) {
    assert(Array.isArray(translated) && translated.length === source.length, `${context}: array length`);
    for (const [index, item] of source.entries())
      validateTranslation(item, translated[index], locale, `${context}[${index}]`);
    return;
  }
  if (source && typeof source === 'object') {
    assert(
      translated && typeof translated === 'object' && !Array.isArray(translated),
      `${context}: object`,
    );
    assert.deepEqual(Object.keys(translated).sort(), Object.keys(source).sort(), `${context}: keys`);
    for (const [name, value] of Object.entries(source))
      validateTranslation(value, translated[name], locale, `${context}.${name}`, name);
    if (Array.isArray(translated.choices)) assertDistinctChoices(translated.choices, locale, context);
    if (Array.isArray(translated.options) && typeof translated.correct === 'number')
      assertDistinctChoices(
        translated.options.map((text) => ({ text })),
        locale,
        context,
      );
    return;
  }
  assert.equal(translated, source, `${context}: structural value changed`);
}
