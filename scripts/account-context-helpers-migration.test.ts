import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { dataMigrations } from './data-migrations';

const root = new URL('..', import.meta.url).pathname;
const migration = '202611220002_learning_context_helpers.sql';

test('registers private context helpers after shadow without public cutover', async () => {
  expect(dataMigrations.filter((name) => name === migration)).toEqual([migration]);
  expect(dataMigrations.indexOf(migration)).toBe(
    dataMigrations.indexOf('202611220001_learning_owner_shadow.sql') + 1,
  );
  const source = await readFile(join(root, 'supabase/migrations', migration), 'utf8');
  expect(source).toMatch(/begin;\nset transaction isolation level serializable;/i);
  expect(source).toMatch(/\ncommit;\s*$/i);
  for (const helper of [
    'assert_live_session',
    'read_actor_session',
    'read_learning_account',
    'read_account_bootstrap',
    'lock_request_context',
    'lock_learning_scope',
  ])
    expect(source).toContain(`kaq_private.${helper}`);
  expect(source).not.toMatch(/create function public\.|alter table public\.|create policy/i);
  expect(source.match(/revoke all on function kaq_private\./gi)?.length).toBeGreaterThanOrEqual(6);
  const runner = await readFile(join(root, 'scripts/run-account-merge-integration.ts'), 'utf8');
  expect(runner).toContain('applyMigration(contextHelpersMigration)');
  expect(runner).toContain("verifyScopeComponents('session', true)");
});
