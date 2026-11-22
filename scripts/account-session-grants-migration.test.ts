import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { dataMigrations } from './data-migrations';

const root = new URL('..', import.meta.url).pathname;
const migration = '202611220003_learning_session_grants.sql';

test('registers private normal and committed-proof session grants without public cutover', async () => {
  expect(dataMigrations.filter((name) => name === migration)).toEqual([migration]);
  expect(dataMigrations).toContain('202611220004_learning_account_creation.sql');
  expect(dataMigrations.indexOf(migration)).toBe(
    dataMigrations.indexOf('202611220004_learning_account_creation.sql') - 1,
  );
  const source = await readFile(join(root, 'supabase/migrations', migration), 'utf8');
  expect(source).toMatch(/begin;\nset transaction isolation level serializable;/i);
  expect(source).toMatch(/\ncommit;\s*$/i);
  for (const name of [
    'account_committed_proof_bindings',
    'validate_account_committed_proof_binding',
    'issue_learning_session_grant',
    'resolve_current_learning_grant',
  ])
    expect(source).toContain(`kaq_private.${name}`);
  expect(source).toMatch(/proof_id uuid/i);
  expect(source).toMatch(/reason = 'proof'.*proof_id is not null/is);
  expect(source).toMatch(/reason <> 'proof'.*proof_id is null/is);
  expect(source).toMatch(/created_at <= fence_at.*oauth_at <= fence_at/is);
  expect(source).toMatch(/intent.state.*committed/is);
  expect(source).toMatch(/proof.consumed_at is null/is);
  expect(source).toMatch(/is not distinct from binding\.account_fence_at/is);
  expect(source).toMatch(/before insert or update on kaq_private\.account_committed_proof_bindings/i);
  expect(source).not.toMatch(/create function public\.|alter table public\.|create policy/i);
  expect(source.match(/revoke all on function kaq_private\./gi)?.length).toBeGreaterThanOrEqual(2);
});
