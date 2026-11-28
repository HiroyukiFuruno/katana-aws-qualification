import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  appliedContentFor,
  appliedResourcesFor,
  assertAppliedCatalogParity,
} from '../src/applied/cases.ts';
import { appliedCases, appliedIndexPage, appliedSlideHref } from '../src/applied/routes.ts';
import { appliedSearchCopy, appliedServiceGroups } from '../src/applied/serviceCatalog.ts';
import { appliedReflection } from '../src/applied/slideContent.ts';
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
  assert(course.includes(appliedSearchCopy(locale).heading), directory);
  assert.deepEqual(
    appliedServiceGroups.map(({ caseId }) => caseId).sort(),
    appliedCases(locale)
      .map(({ id }) => id)
      .sort(),
    directory,
  );
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
    const slides = appliedSlideHref(detail);
    const shell = await htmlAt(slides);
    assert(html.includes(`href="${slides}"`) && course.includes(`href="${slides}"`), slides);
    assert(shell.includes('<meta name="robots" content="noindex, nofollow">'), slides);
    assert(!sitemap.includes(`<loc>${origin}${slides}</loc>`), slides);
    assert(shell.includes('<div id="root"></div>'), slides);
    if (locale === 'ja') {
      for (const section of content.sections) {
        const refersToFigure = section.blocks.some(
          (block) => block.kind === 'paragraph' && /図(?:の|を|に|で|から)/u.test(block.text),
        );
        if (!refersToFigure) continue;
        const own = imagePlacementsFor(imageSlot('applied', entry.id, section.id));
        const reference = imageForSlot(imageSlot('applied-slide', entry.id, section.id), locale);
        assert(own.length || reference, `${slides}#${section.id}: missing referenced diagram`);
      }
    }
    const checks = content.sections
      .map((section) => appliedReflection(entry.id, section))
      .filter(Boolean);
    assert.equal(checks.length, entry.id === 'orders-api-latency' ? 0 : 1, slides);
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
  'Validated service filtering sources, applied article HTML, private slide shells, reflection sources, figures, and glossary in all locales',
);
