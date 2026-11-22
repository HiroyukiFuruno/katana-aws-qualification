import { useEffect } from 'react';
import type { Locale } from './locales';
import { pageTitle } from './pageTitles';

export function usePageTitle(
  page: string | undefined,
  locale: Locale,
  names: Record<string, { name: string }>,
  hasLesson: boolean,
) {
  useEffect(() => {
    if (hasLesson) return;
    const id = page?.split('/')[1];
    document.title = pageTitle(page, locale, id ? names[id]?.name : undefined);
  }, [page, locale, names, hasLesson]);
}
