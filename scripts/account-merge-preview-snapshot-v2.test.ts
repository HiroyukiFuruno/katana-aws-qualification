import { expect, test } from 'bun:test';
import { projectMergePreview } from '../supabase/functions/account-linking/merge/preview.ts';
import { goldenInput } from './account-merge-preview-fixture.test.ts';
import { account, origin, privateV2Document } from './account-merge-private-v2-fixture.ts';

const predecessor = (suffix: string) => `00000000-0000-4000-8000-0000000000${suffix.padStart(2, '0')}`;

const rewrite = (value: unknown, canonical: string, ancestor: string): void => {
  if (Array.isArray(value)) {
    value.forEach((item) => {
      rewrite(item, canonical, ancestor);
    });
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, field] of Object.entries(value)) {
    if (field === account) value[key] = canonical;
    else if (field === origin) value[key] = ancestor;
    else rewrite(field, canonical, ancestor);
  }
};

function v2Input() {
  const input = goldenInput();
  for (const [index, side] of ['source', 'target'].entries()) {
    const source = input[side];
    const privateDocument = privateV2Document();
    const ancestor = predecessor(String(index + 1));
    rewrite(privateDocument, source.accountId, ancestor);
    privateDocument.accounts = [source.accountId];
    privateDocument.lineage_accounts = [ancestor, source.accountId].sort();
    const publicTables = Object.fromEntries(
      Object.entries(source.snapshot.document.tables)
        .filter(([name]) => name.startsWith('public.'))
        .map(([name, rows]) => [
          name,
          name === 'public.fundamentals_final_sessions'
            ? (rows as Record<string, unknown>[]).map((row) => ({ ...row, is_active: true }))
            : rows,
        ]),
    );
    source.snapshot.document = {
      algorithm_version: 2,
      accounts: [source.accountId],
      lineage_accounts: privateDocument.lineage_accounts,
      tables: { ...publicTables, ...privateDocument.tables },
    };
  }
  return input;
}

test('v2 preserves all 12 public rows while requiring every private binding', () => {
  const input = v2Input();
  const plan = projectMergePreview(input);
  expect(
    Object.entries(input.source.snapshot.document.tables)
      .filter(([name]) => name.startsWith('public.'))
      .reduce((count, [, rows]) => count + (Array.isArray(rows) ? rows.length : 0), 0),
  ).toBe(12);
  expect(plan.retained).toHaveLength(23);
  expect(new Set(plan.retained.map((row) => row.table)).size).toBe(12);
  expect(plan.sqlDigests).toEqual({ source: '1'.repeat(64), target: '2'.repeat(64) });
  delete input.source.snapshot.document.tables['kaq_private.account_merge_resume_heads'];
  expect(() => projectMergePreview(input)).toThrow();
});

test('v1 remains valid and v2 rejects unknown document, lineage, and final state changes', () => {
  expect(() => projectMergePreview(goldenInput())).not.toThrow();
  const unknown = v2Input();
  (unknown.source.snapshot.document as Record<string, unknown>).unknown = true;
  expect(() => projectMergePreview(unknown)).toThrow();
  const lineage = v2Input();
  lineage.source.snapshot.document.lineage_accounts = [];
  expect(() => projectMergePreview(lineage)).toThrow();
  const invalidFinal = v2Input();
  const rows = invalidFinal.source.snapshot.document.tables['public.fundamentals_final_sessions'];
  (rows as Array<Record<string, unknown>>)[0].state = 'submitted';
  expect(() => projectMergePreview(invalidFinal)).toThrow();
});

test('v2 accepts persisted presentation snapshot fields and rejects excess fields', () => {
  expect(() => projectMergePreview(v2Input())).not.toThrow();
  const excess = v2Input();
  const profiles = excess.source.snapshot.document.tables['public.roadmap_profiles'];
  (profiles as Array<Record<string, unknown>>)[0].unexpected = true;
  expect(() => projectMergePreview(excess)).toThrow();
});
