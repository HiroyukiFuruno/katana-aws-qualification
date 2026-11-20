import { certifications, studyCourses } from './certifications.ts';
import { type Locale, localePath, locales } from './locales.ts';

export const publishedPages = [
  '',
  'study',
  'study/fundamentals',
  'study/questions',
  'assessment',
  'certifications',
  'glossary',
  'privacy',
  ...certifications.map((cert) => `certifications/${cert.id}`),
  ...studyCourses.map(({ id }) => `study/${id}`),
];

export const accountPages = ['login', 'auth/callback', 'dashboard'];

const studyLocales = new Map<string, Locale>(
  studyCourses.flatMap(({ id, course }) =>
    course?.studyLocale ? [[`study/${id}`, course.studyLocale] as const] : [],
  ),
);

export function publishedLocalesFor(page: string): readonly Locale[] {
  const only = studyLocales.get(page);
  return only ? [only] : locales;
}

const routes = new Map<string, { locale: Locale; page: string }>();
for (const locale of locales) {
  for (const page of [...publishedPages, ...accountPages]) {
    if (publishedLocalesFor(page).includes(locale))
      routes.set(localePath(locale, page), { locale, page });
  }
}

export function routeAt(path: string) {
  if (!path.startsWith('/')) return undefined;
  return routes.get(path.endsWith('/') ? path : `${path}/`);
}
