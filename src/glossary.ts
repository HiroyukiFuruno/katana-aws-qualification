import terms from './glossary-terms.json' with { type: 'json' };
import type { Message } from './messages';

export const glossaryCategories: Record<string, Message> = {
  compute: 'glossaryCompute',
  networking: 'glossaryNetworking',
  storage: 'glossaryStorage',
  database: 'glossaryDatabase',
  security: 'glossarySecurity',
  management: 'glossaryManagement',
  integration: 'glossaryIntegration',
  analytics: 'glossaryAnalytics',
  ai: 'glossaryAi',
  architecture: 'glossaryArchitecture',
};

export const glossaryTags: Record<string, Message> = {
  'access-control': 'glossaryAccessControl',
  encryption: 'glossaryEncryption',
  availability: 'glossaryAvailability',
  'disaster-recovery': 'glossaryDisasterRecovery',
  connectivity: 'glossaryConnectivity',
  serverless: 'glossaryServerless',
  containers: 'glossaryContainers',
  observability: 'glossaryObservability',
  cost: 'glossaryCost',
  'data-protection': 'glossaryDataProtection',
  'data-processing': 'glossaryDataProcessing',
  'event-driven': 'glossaryEventDriven',
  'generative-ai': 'glossaryGenerativeAi',
  'machine-learning': 'glossaryMachineLearning',
  deployment: 'glossaryDeployment',
  governance: 'glossaryGovernance',
};

const alphabetic = new Intl.Collator('en', { sensitivity: 'base' });
export const glossary = [...terms].sort((left, right) => alphabetic.compare(left.term, right.term));

function searchText(value: string) {
  return value.normalize('NFKC').toLowerCase();
}

export function filterGlossary(query: string, category = '', tags: string[] = []) {
  const search = searchText(query.trim());
  const words = search.split(/\s+/);
  const candidates = glossary.filter(
    (entry) =>
      (!category || entry.category === category) && tags.every((tag) => entry.tags.includes(tag)),
  );
  const exact = candidates.find((entry) => searchText(entry.term) === search);
  return exact
    ? [exact]
    : candidates.filter((entry) => {
        const text = searchText(`${entry.term} ${entry.expansion} ${entry.definition}`);
        return words.every((word) => text.includes(word));
      });
}
