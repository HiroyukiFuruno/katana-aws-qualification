import { expect, test } from 'bun:test';
import siteSource from '../src/content/ja.json';
import lessonLinks from '../src/fundamentals/learner/lesson-glossary-links.json';
import { filterGlossary, glossary, glossaryCategories, glossaryTags } from '../src/glossary';
import aliases from '../src/glossary-search-aliases.json';
import terms from '../src/glossary-terms.json';
import { termAnchor } from '../src/glossaryAnchor';
import { locales } from '../src/locales';

test('用語を100語以上に拡充し、全語を分類する', () => {
  expect(terms.length).toBeGreaterThanOrEqual(100);
  expect(new Set(glossary.map((entry) => entry.term.toLowerCase())).size).toBe(glossary.length);
  expect(new Set(glossary.map((entry) => termAnchor(entry.term))).size).toBe(glossary.length);
  for (const entry of glossary) {
    expect(glossaryCategories).toHaveProperty(entry.category);
    expect(entry.tags.length).toBeGreaterThan(0);
    expect(new Set(entry.tags).size).toBe(entry.tags.length);
    for (const tag of entry.tags) expect(glossaryTags).toHaveProperty(tag);
    expect(entry.definition.trim().length).toBeGreaterThan(20);
  }
});

test('基礎教材の用語リンクが実在するスライドと用語を指す', async () => {
  const units = await Bun.file('public/fundamentals/content.json').json();
  const expectedUnits = units.units.map(({ id }: { id: string }) => id).sort();
  const linkedUnits = new Set<string>();
  for (const [stepId, terms] of Object.entries(lessonLinks)) {
    const unitId = stepId.split(':')[0];
    linkedUnits.add(unitId);
    const asset = await Bun.file(`public/fundamentals/delivery/${unitId.split('.')[1]}.json`).json();
    expect(asset.steps.find(({ id }: { id: string }) => id === stepId)?.kind, stepId).toBe('reading');
    for (const term of terms) {
      expect(
        glossary.some((entry) => entry.term === term),
        `${stepId}/${term}`,
      ).toBe(true);
    }
  }
  expect([...linkedUnits].sort()).toEqual(expectedUnits);
});

test('新しい基礎用語・サービスを収録する', () => {
  for (const term of ['EC2', 'S3', 'Lambda', 'DynamoDB', 'Bedrock', 'Embedding', 'Prompt injection']) {
    const entry = glossary.find((entry) => entry.term === term);
    expect(entry).toBeDefined();
    expect(entry?.source).toMatch(/^https:\/\/docs\.aws\.amazon\.com\//);
  }
});

test('各言語の用語集でSLA・SLI・SLOをそれぞれ検索できる', async () => {
  for (const locale of locales) {
    const { glossary: entries } = await Bun.file(`public/translations/${locale}/site.json`).json();
    for (const term of ['SLA', 'SLI', 'SLO']) {
      const exact = entries.filter((entry: (typeof glossary)[number]) => entry.term === term);
      expect(exact, locale).toHaveLength(1);
      expect(filterGlossary(term.toLowerCase(), '', ['observability'], entries)).toEqual(exact);
    }
  }
});

test('全言語に同じ用語を収録し、教材で使う別表記で定義を検索できる', async () => {
  expect(terms).toEqual(siteSource.glossary);
  for (const locale of locales) {
    const { glossary: entries } = await Bun.file(`public/translations/${locale}/site.json`).json();
    expect(
      entries.map(({ term }: (typeof glossary)[number]) => term),
      locale,
    ).toEqual(siteSource.glossary.map(({ term }) => term));
    for (const [alias, term] of Object.entries(aliases)) {
      expect(
        filterGlossary(alias, '', [], entries).map((entry) => entry.term),
        `${locale}/${alias}`,
      ).toEqual([term]);
    }
  }
  for (const [query, term] of [
    ['責任共有モデル', 'Shared responsibility model'],
    ['サブネット', 'Subnet'],
    ['ルートテーブル', 'Route table'],
    ['分散トレース', 'Trace'],
    ['評価期間', 'Evaluation interval'],
    ['データの欠落', 'Missing data'],
    ['接続プール', 'Connection pool'],
    ['品質ゲート', 'Quality gate'],
  ]) {
    expect(filterGlossary(query).map((entry) => entry.term)).toEqual([term]);
  }
});

test('アルファベット順と検索正規化・完全一致優先を維持する', () => {
  expect(glossary.map((entry) => entry.term)).toEqual(
    glossary.map((entry) => entry.term).sort(new Intl.Collator('en', { sensitivity: 'base' }).compare),
  );
  expect(filterGlossary('  ｅｃ２  ').map((entry) => entry.term)).toEqual(['EC2']);
  expect(filterGlossary('Elastic Compute').some((entry) => entry.term === 'EC2')).toBe(true);
  expect(filterGlossary('ベクトル').some((entry) => entry.term === 'Embedding')).toBe(true);
  expect(filterGlossary('  ')).toHaveLength(glossary.length);
});

test('カテゴリと複数タグと検索をANDで組み合わせる', () => {
  expect(filterGlossary('', 'compute', ['serverless']).map((entry) => entry.term)).toContain('Lambda');
  expect(filterGlossary('Lambda', 'storage')).toEqual([]);
  const encryptedStorage = filterGlossary('', 'storage', ['encryption', 'data-protection']);
  expect(encryptedStorage.map((entry) => entry.term)).toContain('SSE-KMS');
  for (const entry of encryptedStorage) {
    expect(entry.category).toBe('storage');
    expect(entry.tags).toEqual(expect.arrayContaining(['encryption', 'data-protection']));
  }
  expect(filterGlossary('zzzz-nonexistent')).toEqual([]);
  expect(filterGlossary('SSE-KMS', 'storage', ['serverless'])).toEqual([]);
});

test('Control TowerのGuardrailとBedrock Guardrailsを別の概念として分類する', () => {
  const governance = filterGlossary('', 'management', ['governance']);
  expect(governance.map((entry) => entry.term)).toContain('Guardrail');
  const ai = filterGlossary('', 'ai', ['generative-ai']);
  expect(ai.map((entry) => entry.term)).not.toContain('Guardrail');
  expect(ai.map((entry) => entry.term)).toContain('Bedrock Guardrails');
  expect(glossary.find((entry) => entry.term === 'Bedrock')?.definition).toContain('Bedrock Guardrails');
  expect(glossary.find((entry) => entry.term === 'Guardrail')?.definition).toContain('Control Tower');
});
