import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { rawColumns } from '../supabase/functions/account-linking/merge/validation-columns.ts';
import { rawColumnsV2 } from '../supabase/functions/account-linking/merge/validation-v2.ts';

const migration = readFileSync('supabase/migrations/202611210005_presentation_storage.sql', 'utf8');
const snapshot = readFileSync('supabase/account-merge/learning-snapshot.sql', 'utf8');
const storedColumns = [
  ['roadmap_profiles', 'presentation', 'add column presentation jsonb not null'] as const,
  ['exam_sessions', 'presentation', 'add column presentation jsonb not null'] as const,
  ['migration_items', 'presentation_hash', 'add column presentation_hash bytea'] as const,
];

test('v1 and v2 snapshot column contracts include every presentation-storage column', () => {
  expect(snapshot).toContain('jsonb_agg(to_jsonb(r)');
  for (const [table, column, ddl] of storedColumns) {
    expect(migration).toContain(`alter table public.${table}\n  ${ddl}`);
    expect(rawColumns[table]).toContain(column);
    expect(rawColumnsV2[table]).toContain(column);
  }
});
