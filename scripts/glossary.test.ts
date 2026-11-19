import { expect, test } from 'bun:test';
import terms from '../src/glossary-terms.json';
import { filterGlossary, glossary, glossaryCategories, glossaryTags } from '../src/glossary';

test('用語を100語以上に拡充し、全語を分類する', () => {
  expect(terms.length).toBeGreaterThanOrEqual(100);
  expect(new Set(glossary.map((entry) => entry.term.toLowerCase())).size).toBe(glossary.length);
  for (const entry of glossary) {
    expect(glossaryCategories).toHaveProperty(entry.category);
    expect(entry.tags.length).toBeGreaterThan(0);
    expect(new Set(entry.tags).size).toBe(entry.tags.length);
    for (const tag of entry.tags) expect(glossaryTags).toHaveProperty(tag);
    expect(entry.definition.trim().length).toBeGreaterThan(20);
  }
});

test('新しい基礎用語・サービスを収録する', () => {
  for (const term of ['EC2', 'S3', 'Lambda', 'DynamoDB', 'Bedrock', 'Embedding', 'Prompt injection']) {
    const entry = glossary.find((entry) => entry.term === term);
    expect(entry).toBeDefined();
    expect(entry?.source).toMatch(/^https:\/\/docs\.aws\.amazon\.com\//);
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
