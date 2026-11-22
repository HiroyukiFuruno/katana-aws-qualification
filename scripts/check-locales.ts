import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { quantityVariantData, validateQuantityVariants } from '../src/locales/quantity.ts';
import { localePath, locales } from '../src/locales.ts';
import { messages } from '../src/messages.ts';
import clarificationKeys from '../src/question-clarifications.json' with { type: 'json' };
import { publishedLocalesFor, publishedPages, routeAt } from '../src/routes.ts';
import { hardcodedCssIssues, hardcodedUiIssues } from './hardcoded-ui.ts';
import { translationReferences } from './i18n-references.ts';
import { translationIssues } from './translation-quality.ts';

function tokens(value: string) {
  return [...value.matchAll(/\{(\w+)\}/g)].map(([, name]) => name).sort();
}

const keys = Object.keys(messages.ja).sort();
validateQuantityVariants(quantityVariantData, messages);
for (const locale of locales) {
  const variants = quantityVariantData[locale];
  for (const [key, variant] of Object.entries(variants ?? {}))
    for (const [form, value] of Object.entries(variant.forms))
      assert.deepEqual(
        translationIssues(locale, { ...messages[locale], [key]: value }, messages.ja, messages.en),
        [],
        `${locale} quantity translation quality: ${key}.${form}`,
      );
}
for (const entries of Object.values(clarificationKeys))
  for (const key of entries)
    assert(Object.hasOwn(messages.ja, key), `Unknown question clarification: ${key}`);
assert.deepEqual(
  (await readdir('src/locales')).filter((file) => file.endsWith('.json')).sort(),
  locales.map((locale) => `${locale}.json`).sort(),
  'Each supported locale must have exactly one JSON file',
);

for (const locale of locales) {
  const dictionary = messages[locale];
  assert.deepEqual(
    translationIssues(locale, dictionary, messages.ja, messages.en),
    [],
    `${locale} translation quality`,
  );
  assert.deepEqual(Object.keys(dictionary).sort(), keys, `${locale} keys differ from ja`);
  for (const key of Object.keys(messages.ja) as (keyof typeof messages.ja)[]) {
    const value = dictionary[key];
    assert(typeof value === 'string' && value.trim(), `${key} is empty or invalid in ${locale}`);
    assert.deepEqual(tokens(value), tokens(messages.ja[key]), `${key} placeholders differ in ${locale}`);
    if (/^cert[A-Z]\w*Name$/.test(key)) {
      assert.equal(value, messages.en[key], `${key} must retain the shared official proper name`);
    }
  }
}

const sourceFiles = await readdir('src', { recursive: true });
for (const file of (await readdir('scripts/fundamentals-delivery')).filter((file) =>
  file.endsWith('.ts'),
)) {
  const path = `scripts/fundamentals-delivery/${file}`;
  assert.deepEqual(hardcodedUiIssues(await readFile(path, 'utf8'), path, true), [], path);
}
for (const file of sourceFiles.filter((name) => name.endsWith('.css')))
  assert.deepEqual(hardcodedCssIssues(await readFile(`src/${file}`, 'utf8'), file), [], file);
const sources = sourceFiles.filter((name) => /\.tsx?$/.test(name));
assert(sources.length > 0, 'No UI sources checked');
for (const file of sources) {
  const path = join('src', file);
  const content = await readFile(path, 'utf8');
  if (file.endsWith('.tsx'))
    assert.deepEqual(hardcodedUiIssues(content, file), [], `${file} hardcoded display text`);
  for (const key of translationReferences(content, path)) {
    assert(Object.hasOwn(messages.ja, key), `${file} references missing message ${key}`);
  }
}

for (const locale of locales) {
  for (const page of publishedPages) {
    const path = localePath(locale, page);
    if (!publishedLocalesFor(page).includes(locale)) {
      assert.equal(routeAt(path), undefined, path);
      continue;
    }
    assert.deepEqual(routeAt(path), { locale, page }, path);
    if (path !== '/') assert.deepEqual(routeAt(path.slice(0, -1)), { locale, page }, path);
  }
}
for (const missing of [
  '/en/',
  '/en/study/',
  '/xx/',
  '/ja/study/missing/',
  '/assessment/extra/',
  '/ja//glossary/',
]) {
  assert.equal(routeAt(missing), undefined, missing);
}
console.log(`Validated ${keys.length} messages and ${locales.length} locale routes`);
