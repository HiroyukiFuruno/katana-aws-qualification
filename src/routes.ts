import { certifications } from './certifications.ts';
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
  ...certifications.filter((cert) => cert.course).map((cert) => `study/${cert.id}`),
];

export const accountPages = ['login', 'auth/callback', 'dashboard'];

const routes = new Map<string, { locale: Locale; page: string }>();
for (const locale of locales) {
  for (const page of [...publishedPages, ...accountPages]) {
    routes.set(localePath(locale, page), { locale, page });
  }
}

export function routeAt(path: string) {
  if (!path.startsWith('/')) return undefined;
  return routes.get(path.endsWith('/') ? path : `${path}/`);
}
