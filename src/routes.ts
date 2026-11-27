import { appliedStudyPages } from './applied/routes.ts';
import { certifications, studyCourses } from './certifications.ts';
import { privateLessonPageNames, publicLessonPageNames } from './fundamentals/delivery/routePages.ts';
import { type Locale, localePath, locales } from './locales.ts';
import { qualificationLearningPages } from './qualificationLearning/routes.ts';

export const publishedPages = [
  '',
  'study',
  'study/fundamentals',
  ...appliedStudyPages,
  ...qualificationLearningPages,
  'study/questions',
  'assessment',
  'certifications',
  'certifications/overview',
  'glossary',
  'privacy',
  ...certifications.map((cert) => `certifications/${cert.id}`),
  ...studyCourses.map(({ id }) => `study/${id}`),
  ...publicLessonPageNames,
];

export const accountPages = ['login', 'auth/callback', 'dashboard', 'account/settings'];
export const privateLessonPages = privateLessonPageNames;

export function publishedLocalesFor(_page: string): readonly Locale[] {
  return locales;
}

const routes = new Map<string, { locale: Locale; page: string }>();
for (const locale of locales) {
  for (const page of [...publishedPages, ...accountPages, ...privateLessonPages]) {
    if (publishedLocalesFor(page).includes(locale))
      routes.set(localePath(locale, page), { locale, page });
  }
}

export function routeAt(path: string) {
  if (!path.startsWith('/')) return undefined;
  return routes.get(path.endsWith('/') ? path : `${path}/`);
}
