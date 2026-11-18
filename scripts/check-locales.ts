import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { localePath, locales } from '../src/locales.ts';
import { messages } from '../src/messages.ts';
import { publishedPages, routeAt } from '../src/routes.ts';

function tokens(value: string) {
  return [...value.matchAll(/\{(\w+)\}/g)].map(([, name]) => name).sort();
}

for (const [key, row] of Object.entries(messages)) {
  assert(row.en.trim() && row.ja.trim(), `${key} must have Japanese and English messages`);
  for (const [locale, value] of Object.entries(row)) {
    assert(
      locales.some((supported) => supported === locale),
      `${key} has unexpected locale ${locale}`,
    );
    assert(value.trim(), `${key} is empty in ${locale}`);
    assert.deepEqual(tokens(value), tokens(row.en), `${key} placeholders differ in ${locale}`);
  }

  assert.deepEqual(Object.keys(row).sort(), [...locales].sort(), `${key} is missing a locale`);
}

for (const file of (await readdir('src')).filter((name) => name.endsWith('.tsx'))) {
  const content = await readFile(`src/${file}`, 'utf8');
  for (const [, key] of content.matchAll(/\bt\(['"]([a-zA-Z]+)['"]/g)) {
    assert(Object.hasOwn(messages, key), `${file} references missing message ${key}`);
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
console.log(`Validated ${Object.keys(messages).length} messages and ${locales.length} locale routes`);
