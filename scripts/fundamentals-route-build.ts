import { imageForSlot, imagePlacementsFor } from '../src/images/catalog.ts';
import { access, readFile } from 'node:fs/promises';
import type { DeliveryUnitAsset } from '../src/fundamentals/delivery/artifactTypes';
import { lessonPath } from '../src/fundamentals/delivery/navigation';
import {
  privateLessonPageNames,
  publicLessonPageNames,
} from '../src/fundamentals/delivery/routePages.ts';
import { localePath, locales } from '../src/locales.ts';
import { routeAt } from '../src/routes.ts';

const root = process.cwd();
const publicPaths = locales.flatMap((locale) =>
  publicLessonPageNames.map((page) => localePath(locale, page)),
);
const privatePaths = locales.flatMap((locale) =>
  privateLessonPageNames.map((page) => localePath(locale, page)),
);

function assertRoutes(paths: string[], visibility: 'public' | 'private') {
  for (const path of paths) {
    const resolved = routeAt(path);
    if (!resolved) throw new Error(`Missing ${visibility} route: ${path}`);
    if (visibility === 'public' && privateLessonPageNames.some((page) => path.includes(`/${page}/`)))
      throw new Error(`Private route leaked into public set: ${path}`);
  }
}

assertRoutes(publicPaths, 'public');
assertRoutes(privatePaths, 'private');
if (publicLessonPageNames.length !== new Set(publicLessonPageNames).size)
  throw new Error('Duplicate public lesson pages.');
if (privateLessonPageNames.length !== new Set(privateLessonPageNames).size)
  throw new Error('Duplicate private lesson pages.');

for (const slot of imagePlacementsFor('fundamentals')) {
  const stepId = slot.slice('fundamentals/'.length);
  const unitId = stepId.split(':')[0];
  const slug = unitId.split('.')[1];
  const asset: DeliveryUnitAsset = JSON.parse(
    await readFile(`public/fundamentals/delivery/${slug}.json`, 'utf8'),
  );
  const step = asset.steps.find(({ id }) => id === stepId);
  if (step?.kind !== 'reading') throw new Error(`Missing reading step for figure: ${stepId}`);
  for (const locale of locales) {
    const figure = imageForSlot(slot, locale);
    if (!figure) throw new Error(`Missing lesson diagram: ${slot}/${locale}`);
    const path = lessonPath({ locale, unitId, stage: 'slides', position: step.position });
    const html = await readFile(`dist${path}index.html`, 'utf8');
    if (
      !html.includes(`<figure class="lesson-figure" lang="${figure.language}">`) ||
      !html.includes(`src="${figure.src}"`) ||
      !html.includes(`href="${figure.src}"`)
    )
      throw new Error(`Missing figure or expansion link in static reading: ${path}`);
  }
}

const sitemap = `${root}/dist/sitemap.xml`;
if (
  await access(sitemap)
    .then(() => true)
    .catch(() => false)
) {
  const xml = await readFile(sitemap, 'utf8');
  for (const path of privatePaths)
    if (xml.includes(`https://kaq.katana-projects.org${path}`))
      throw new Error(`Private path in sitemap: ${path}`);
  for (const path of publicPaths)
    if (!xml.includes(`https://kaq.katana-projects.org${path}`))
      throw new Error(`Public path missing from sitemap: ${path}`);
}

console.log(
  `Validated ${publicPaths.length} public and ${privatePaths.length} private lesson routes across ${locales.length} locales.`,
);
