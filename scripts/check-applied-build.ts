import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import figures from '../src/applied/figures.json' with { type: 'json' };
import resources from '../src/applied/resources.json' with { type: 'json' };
import { appliedCases, appliedIndexPage } from '../src/applied/routes.ts';
import { localePath, locales } from '../src/locales.ts';

const origin = 'https://kaq.katana-projects.org';
const htmlAt = (route: string) => readFile(join('dist', route, 'index.html'), 'utf8');
const sitemap = await readFile('dist/sitemap.xml', 'utf8');
const shared = Object.values(figures);
for (const { path } of shared) assert((await readFile(join('dist', path), 'utf8')).includes('<svg'));

for (const locale of locales) {
  const directory = localePath(locale, appliedIndexPage);
  const [study, course, base] = await Promise.all([
    htmlAt(localePath(locale, 'study')),
    htmlAt(directory),
    htmlAt(localePath(locale, 'study/fundamentals')),
  ]);
  assert(study.includes(`href="${directory}"`) && base.includes(`href="${directory}"`), directory);
  assert(sitemap.includes(`<loc>${origin}${directory}</loc>`), directory);
  const bank = JSON.parse(await readFile(`dist/translations/${locale}/site.json`, 'utf8'));
  const glossary = new Set<string>(bank.glossary.map(({ term }: { term: string }) => term));

  for (const entry of appliedCases(locale)) {
    const detail = localePath(locale, entry.page);
    const html = await htmlAt(detail);
    assert(course.includes(`href="${detail}"`), detail);
    assert(html.includes(`<html lang="${locale}">`) && html.includes('<h1>'), detail);
    assert(html.includes(`<link rel="canonical" href="${origin}${detail}">`), detail);
    assert(html.includes(`href="${directory}"`) && (html.match(/<h2[ >]/gu)?.length ?? 0) >= 5, detail);
    assert(sitemap.includes(`<loc>${origin}${detail}</loc>`), detail);
    for (const alternate of locales)
      assert(
        html.includes(`hreflang="${alternate}" href="${origin}${localePath(alternate, entry.page)}"`),
        detail,
      );
    for (const figure of shared)
      assert(
        html.includes(`<figure class="applied-case-figure" lang="en"><img src="${figure.path}"`),
        detail,
      );
    for (const { slug } of entry.prerequisites)
      assert(html.includes(`href="${localePath(locale, `study/fundamentals/${slug}`)}"`), detail);
    for (const term of resources[entry.id].glossaryTerms)
      assert(glossary.has(term), `${detail}/${term}`);
  }
}

console.log(
  'Validated applied study directories, published article HTML, shared English figures, and glossary in all locales',
);
