import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { localePath, locales } from '../src/locales.ts';
import { messages } from '../src/messages.ts';
import { publishedLocalesFor, publishedPages, routeAt } from '../src/routes.ts';
import { translationReferences } from './i18n-references.ts';

function tokens(value: string) {
  return [...value.matchAll(/\{(\w+)\}/g)].map(([, name]) => name).sort();
}

const keys = Object.keys(messages.ja).sort();
assert.deepEqual(
  (await readdir('src/locales')).filter((file) => file.endsWith('.json')).sort(),
  locales.map((locale) => `${locale}.json`).sort(),
  'Each supported locale must have exactly one JSON file',
);

for (const locale of locales) {
  const dictionary = messages[locale];
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

const sources = (await readdir('src', { recursive: true, withFileTypes: true }))
  .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
  .map((entry) => join(entry.parentPath, entry.name));
assert(sources.length > 0, 'No UI sources checked');
for (const file of sources) {
  const content = await readFile(file, 'utf8');
  for (const key of translationReferences(content, file)) {
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
