import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  appliedContentFor,
  appliedFiguresFor,
  appliedResourcesFor,
  assertAppliedCatalogParity,
} from '../src/applied/cases.ts';
import { appliedCases, appliedIndexPage } from '../src/applied/routes.ts';
import { localePath, locales } from '../src/locales.ts';

const origin = 'https://kaq.katana-projects.org';
const htmlAt = (route: string) => readFile(join('dist', route, 'index.html'), 'utf8');
const sitemap = await readFile('dist/sitemap.xml', 'utf8');
assertAppliedCatalogParity();

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
    const content = appliedContentFor(locale, entry.id);
    const figures = Object.values(appliedFiguresFor(content));
    const resources = appliedResourcesFor(entry.id);
    for (const { path } of figures)
      assert((await readFile(join('dist', path), 'utf8')).includes('<svg'), path);
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
    const renderedFigures = [
      ...html.matchAll(
        /<figure class="applied-case-figure" lang="en"><a href="([^"]+)"[^>]*><img src="([^"]+)"/gu,
      ),
    ].map(([, link, source]) => {
      assert.equal(link, source, detail);
      return source;
    });
    assert.deepEqual(renderedFigures.sort(), figures.map((figure) => figure.path).sort(), detail);
    for (const { slug } of entry.prerequisites)
      assert(html.includes(`href="${localePath(locale, `study/fundamentals/${slug}`)}"`), detail);
    for (const term of resources.glossaryTerms) assert(glossary.has(term), `${detail}/${term}`);
  }
}

console.log(
  'Validated applied study directories, published article HTML, shared English figures, and glossary in all locales',
);
