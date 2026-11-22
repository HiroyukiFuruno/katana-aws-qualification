import { expect, test } from 'bun:test';
import { type Message, messages } from '../src/messages';
import type { SiteContent } from '../src/contentTypes';
import { createDashboardDisplayLabels } from '../src/dashboard/displayLabels';

const content: SiteContent = {
  certifications: { 'saa-c03': { name: 'Solutions Architect', focus: 'Architecture' } },
  guides: {},
  skills: {} as SiteContent['skills'],
  glossary: [],
  assessment: [],
  labels: { 'オリジナル模試 2026-11': 'Original mock 2026-11', セキュリティ: 'Security' },
};
const t = (key: Message, values: Record<string, string | number> = {}) => {
  const labels: Partial<Record<Message, string>> = {
    learnFundamentals: 'Learn fundamentals',
    unavailableDomain: 'Unavailable',
  };
  return (labels[key] ?? messages.en[key]).replace(/\{(\w+)\}/g, (token, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : token,
  );
};

test('dashboard labels translate presentation without changing canonical filters', () => {
  const labels = createDashboardDisplayLabels(content, t, [
    {
      unitId: 'fundamentals.cloud-concepts',
      title: 'Cloud concepts',
      href: '/en/study/fundamentals/cloud-concepts',
      summary: {
        unitId: 'fundamentals.cloud-concepts',
        contentVersion: 'hash',
        completedSlides: 0,
        totalSlides: 1,
        completedCheckpoints: 0,
        totalCheckpoints: 0,
        activeFinalSessionId: null,
        passedAt: null,
        latestScore: null,
        requiredScore: null,
      },
    },
  ]);
  expect(labels.certification('saa-c03')).toBe('Solutions Architect');
  expect(labels.certification('fundamentals')).toBe('Learn fundamentals');
  expect(labels.category('fundamentals.cloud-concepts')).toBe('Cloud concepts');
  expect(labels.category('セキュリティ')).toBe('Security');
  expect(labels.category('unknown-history')).toBe('Unavailable');
  expect(labels.revision('オリジナル模試 2026-11', 2)).toBe('Original mock 2026-11 / r2');
});
