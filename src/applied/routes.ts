import type { Locale } from '../locales.ts';
import { type AppliedCaseCatalog, appliedCaseIds, appliedCatalog } from './cases.ts';

export const appliedIndexPage = 'study/applied';

export const appliedStudyPages = [
  appliedIndexPage,
  ...appliedCaseIds.map((id) => `${appliedIndexPage}/${id}`),
];

export const appliedSlidePages = appliedCaseIds.map((id) => `${appliedIndexPage}/${id}/slides`);

export function appliedArticleForSlides(page: string) {
  return appliedSlidePages.includes(page) ? page.slice(0, -'/slides'.length) : undefined;
}

export type AppliedCaseEntry = AppliedCaseCatalog & { id: string; page: string };

export function appliedDirectory(locale: Locale) {
  return appliedCatalog[locale].index;
}

export function appliedCases(locale: Locale): AppliedCaseEntry[] {
  return appliedCaseIds.map((id) => ({
    id,
    page: `${appliedIndexPage}/${id}`,
    ...appliedCatalog[locale].cases[id],
  }));
}

export function appliedCaseForPage(locale: Locale, page: string) {
  return appliedCases(locale).find((entry) => entry.page === page);
}

export function appliedPageMetadata(locale: Locale, page: string) {
  if (page === appliedIndexPage) return appliedDirectory(locale);
  return appliedCaseForPage(locale, page);
}

export function appliedSlideHref(articleHref: string, sectionId?: string) {
  const step = sectionId ? `?${new URLSearchParams({ step: sectionId })}` : '';
  return `${articleHref}slides/${step}`;
}
