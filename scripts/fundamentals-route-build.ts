import { access, readFile } from 'node:fs/promises';
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
