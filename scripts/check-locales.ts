import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { localePath, locales } from '../src/locales.ts';
import { messages } from '../src/messages.ts';
import { publishedPages, routeAt } from '../src/routes.ts';

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
  }
}

for (const file of (await readdir('src')).filter((name) => name.endsWith('.tsx'))) {
  const content = await readFile(`src/${file}`, 'utf8');
  for (const [, key] of content.matchAll(/\bt\(['"]([a-zA-Z]+)['"]/g)) {
    assert(Object.hasOwn(messages.ja, key), `${file} references missing message ${key}`);
  }
}

for (const locale of locales) {
  for (const page of publishedPages) {
    const path = localePath(locale, page);
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
