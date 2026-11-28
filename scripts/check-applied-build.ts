import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  appliedContentFor,
  appliedResourcesFor,
  assertAppliedCatalogParity,
} from '../src/applied/cases.ts';
import { appliedCases, appliedIndexPage } from '../src/applied/routes.ts';
import { imageForSlot, imagePlacementsFor, imageSlot } from '../src/images/catalog.ts';
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
    const placements = imagePlacementsFor(imageSlot('applied', entry.id));
    const anchors = new Set(
      content.sections.flatMap((section) =>
        ['start', ...section.blocks.map(({ key }) => key)].map((anchor) =>
          imageSlot('applied', entry.id, section.id, anchor),
        ),
      ),
    );
    const figures = placements.map((slot) => {
      assert(anchors.has(slot), slot);
      const image = imageForSlot(slot, locale);
      assert(image, slot);
      return image.src;
    });
    const resources = appliedResourcesFor(entry.id);
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
        /<figure class="applied-case-figure" lang="(?:en|ja)"><a href="([^"]+)"[^>]*><img src="([^"]+)"/gu,
      ),
    ].map(([, link, source]) => {
      assert.equal(link, source, detail);
      return source;
    });
    assert.deepEqual(renderedFigures.sort(), figures.sort(), detail);
    for (const { slug } of entry.prerequisites)
      assert(html.includes(`href="${localePath(locale, `study/fundamentals/${slug}`)}"`), detail);
    for (const term of resources.glossaryTerms) assert(glossary.has(term), `${detail}/${term}`);
  }
}

console.log(
  'Validated applied study directories, published article HTML, localized figures, and glossary in all locales',
);
