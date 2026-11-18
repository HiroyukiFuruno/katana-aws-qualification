export const locales = ['en', 'ja', 'zh-CN', 'zh-TW', 'ko', 'pt', 'fr', 'de', 'es', 'it'] as const;
export type Locale = (typeof locales)[number];

export function localePath(locale: Locale, page = '') {
  return (
    '/' +
    [locale === 'en' ? '' : locale, page].filter(Boolean).join('/') +
    (locale === 'en' && !page ? '' : '/')
  );
}

export function localeAt(path: string): Locale {
  const first = path.split('/')[1];
  return locales.find((locale) => locale === first) ?? 'en';
}

export function pageAt(path: string) {
  const segments = path.split('/').filter(Boolean);
  if (locales.some((locale) => locale === segments[0])) segments.shift();
  return segments.join('/');
}
