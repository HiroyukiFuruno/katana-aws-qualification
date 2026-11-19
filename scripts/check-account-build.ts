import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { localePath, locales } from '../src/locales.ts';
import { accountPages } from '../src/routes.ts';

const sitemap = await readFile('dist/sitemap.xml', 'utf8');
for (const locale of locales) {
  for (const page of accountPages) {
    const path = localePath(locale, page);
    const html = await readFile(join('dist', path, 'index.html'), 'utf8');
    assert(html.includes('name="robots" content="noindex, nofollow"'), path);
    assert(html.includes('name="referrer" content="no-referrer"'), path);
    assert(!html.includes('rel="canonical"'), path);
    assert(!sitemap.includes(`https://kaq.katana-projects.org${path}`), path);
  }
}
console.log(`Validated ${locales.length * accountPages.length} private route shells`);
