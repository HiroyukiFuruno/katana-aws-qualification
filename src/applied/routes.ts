import type { Locale } from '../locales.ts';
import catalog from './catalog.json' with { type: 'json' };

export const appliedIndexPage = 'study/applied';
export const ordersCaseId = 'orders-api-latency';
const appliedCaseIds = [ordersCaseId] as const;

export const appliedStudyPages = [
  appliedIndexPage,
  ...appliedCaseIds.map((id) => `${appliedIndexPage}/${id}`),
];

export function appliedDirectory(locale: Locale) {
  return catalog[locale].index;
}

export function appliedCases(locale: Locale) {
  return appliedCaseIds.map((id) => ({
    id,
    page: `${appliedIndexPage}/${id}`,
    ...catalog[locale].cases[id],
  }));
}

export function appliedPageMetadata(locale: Locale, page: string) {
  if (page === appliedIndexPage) return appliedDirectory(locale);
  return appliedCases(locale).find((entry) => entry.page === page);
}
