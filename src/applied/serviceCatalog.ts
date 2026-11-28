import type { Locale } from '../locales.ts';
import catalog from './service-catalog.json' with { type: 'json' };

export type AppliedServiceGroup = {
  id: 'private-application-delivery' | 'database-investigation' | 'safe-release-recovery';
  products: readonly string[];
  caseId: 'private-app-s3' | 'orders-api-latency' | 'checkout-deployment-recovery';
};

export const appliedServiceGroups = catalog.groups as readonly AppliedServiceGroup[];

export function appliedServiceCopy(locale: Locale, id: AppliedServiceGroup['id']) {
  return catalog.copy[locale].groups[id];
}

export function appliedSearchCopy(locale: Locale) {
  return catalog.copy[locale].search;
}

export function appliedCaseShortTitle(locale: Locale, caseId: string) {
  const group = appliedServiceGroups.find((item) => item.caseId === caseId);
  if (!group) throw new Error(`Missing applied service group: ${caseId}`);
  return appliedServiceCopy(locale, group.id).label;
}
