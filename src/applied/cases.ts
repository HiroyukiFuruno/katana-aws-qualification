import type { Locale } from '../locales.ts';
import { locales } from '../locales.ts';
import catalogSource from './catalog.json' with { type: 'json' };
import ordersApiLatency from './content.json' with { type: 'json' };
import checkoutDeploymentRecovery from './content-checkout-deployment-recovery.json' with {
  type: 'json',
};
import privateAppS3 from './content-private-app-s3.json' with { type: 'json' };
import resourcesSource from './resources.json' with { type: 'json' };
import type { AppliedCaseContent } from './types.ts';

export type AppliedPrerequisite = { slug: string; title: string };
export type AppliedCaseCatalog = {
  title: string;
  description: string;
  prerequisites: AppliedPrerequisite[];
};
type AppliedResource = { glossaryTerms: string[] };
type AppliedCatalog = Record<
  Locale,
  { index: { title: string; description: string }; cases: Record<string, AppliedCaseCatalog> }
>;

export const appliedCatalog = catalogSource as AppliedCatalog;
const appliedContent = {
  'orders-api-latency': ordersApiLatency,
  'private-app-s3': privateAppS3,
  'checkout-deployment-recovery': checkoutDeploymentRecovery,
} as unknown as Record<string, Record<Locale, AppliedCaseContent>>;
const appliedResources = resourcesSource as Record<string, AppliedResource>;

export const appliedCaseIds = Object.keys(appliedCatalog.en.cases);

export function assertAppliedCatalogParity() {
  const expected = appliedCaseIds.join(',');
  for (const locale of locales) {
    const actual = Object.keys(appliedCatalog[locale].cases).join(',');
    if (actual !== expected) throw new Error(`Applied case catalog differs for ${locale}: ${actual}`);
  }
}

export function appliedContentFor(locale: Locale, caseId: string): AppliedCaseContent {
  const content = appliedContent[caseId]?.[locale];
  if (!content || content.id !== caseId) throw new Error(`Missing applied content: ${locale}/${caseId}`);
  return content;
}

export function appliedResourcesFor(caseId: string) {
  const resource = appliedResources[caseId];
  if (!resource) throw new Error(`Missing applied resources: ${caseId}`);
  return resource;
}
