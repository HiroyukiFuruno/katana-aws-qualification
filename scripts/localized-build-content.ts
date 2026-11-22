import { readFile } from 'node:fs/promises';
import type { SiteContent } from '../src/contentTypes';
import type { DeliveryIndexAsset } from '../src/fundamentals/delivery/artifactTypes';
import { lessonPageAt } from '../src/fundamentals/delivery/routePages.ts';
import type { Locale } from '../src/locales';
import { localePath } from '../src/locales.ts';

export async function localizedBuildContent(locale: Locale) {
  const site: SiteContent = JSON.parse(
    await readFile(`public/translations/${locale}/site.json`, 'utf8'),
  );
  const path =
    locale === 'ja'
      ? 'public/fundamentals/delivery/index.json'
      : `public/translations/${locale}/fundamentals/delivery/index.json`;
  const lessons: DeliveryIndexAsset = JSON.parse(await readFile(path, 'utf8'));
  return {
    titleFor(page: string) {
      const lesson = lessonPageAt(localePath(locale, page));
      if (lesson) {
        const title = lessons.units.find((unit) => unit.unitId === lesson.route.unitId)?.title;
        if (!title) throw new Error(`Missing localized lesson title: ${locale}/${page}`);
        return title;
      }
      const id = page.split('/')[1];
      const certification = site.certifications[id];
      return certification ? `${certification.name} (${id.toUpperCase()})` : undefined;
    },
  };
}
