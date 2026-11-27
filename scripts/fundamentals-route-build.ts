import { access, readFile } from 'node:fs/promises';
import type { DeliveryUnitAsset } from '../src/fundamentals/delivery/artifactTypes';
import { lessonPath } from '../src/fundamentals/delivery/navigation';
import networkFigures from '../src/fundamentals/delivery/network-figures.json' with { type: 'json' };
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

for (const [stepId, figure] of Object.entries(networkFigures)) {
  const unitId = stepId.split(':')[0];
  const slug = unitId.split('.')[1];
  const asset: DeliveryUnitAsset = JSON.parse(
    await readFile(`public/fundamentals/delivery/${slug}.json`, 'utf8'),
  );
  const step = asset.steps.find(({ id }) => id === stepId);
  if (step?.kind !== 'reading') throw new Error(`Missing reading step for figure: ${stepId}`);
  const svg = await readFile(`dist${figure.url}`, 'utf8');
  if (!svg.includes('<svg') || /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(svg))
    throw new Error(`Invalid English network diagram: ${figure.url}`);
  const viewBox = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/u);
  if (
    !viewBox ||
    Math.round(Number(viewBox[1])) !== figure.width ||
    Math.round(Number(viewBox[2])) !== figure.height
  )
    throw new Error(`Incorrect network diagram dimensions: ${figure.url}`);
  for (const locale of locales) {
    const path = lessonPath({ locale, unitId, stage: 'slides', position: step.position });
    const html = await readFile(`dist${path}index.html`, 'utf8');
    if (
      !html.includes(
        `<img src="${figure.url}" alt="${figure.alt}" width="${figure.width}" height="${figure.height}">`,
      )
    )
      throw new Error(`Missing shared figure in static reading: ${path}`);
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
