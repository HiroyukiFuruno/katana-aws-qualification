export const locales = ['en', 'ja', 'zh-CN', 'zh-TW', 'ko', 'pt', 'fr', 'de', 'es', 'it'] as const;
export type Locale = (typeof locales)[number];

export function localeForPath(path: string): Locale {
  const prefix = path.startsWith('/') ? path.split('/')[1] : undefined;
  return locales.find((locale) => locale === prefix) ?? 'en';
}

export function localePath(locale: Locale, page = '') {
  return (
    '/' +
    [locale === 'en' ? '' : locale, page].filter(Boolean).join('/') +
    (locale === 'en' && !page ? '' : '/')
  );
}
