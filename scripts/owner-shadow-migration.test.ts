import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ownerShadowDo } from '../test/account-merge/owner-shadow-source.ts';
import { dataMigrations } from './data-migrations.ts';

const root = new URL('..', import.meta.url).pathname;
const migration = '202611220001_learning_owner_shadow.sql';

test('registers the owner shadow migration once and keeps it deferred in the account runner', async () => {
  expect(dataMigrations.filter((name) => name === migration)).toEqual([migration]);
  const runner = await readFile(join(root, 'scripts/run-account-merge-integration.ts'), 'utf8');
  expect(runner).toContain(`const ownerShadowMigration = '${migration}'`);
  expect(runner).toContain(
    'await verifyOwnerShadowMigration(() => applyMigration(ownerShadowMigration))',
  );
  expect(runner).toContain('await verifyOwnerShadowProductionOps()');
  expect(runner).toContain("KAQ_ACCOUNT_POSTGRES_IMAGE?.startsWith('postgres:17')");
});

test('keeps PostgreSQL 18 as the default while allowing the required PostgreSQL 17 role fixture', async () => {
  const compose = await readFile(join(root, 'test/account-merge/compose.yml'), 'utf8');
  expect(compose).toContain('$' + '{KAQ_ACCOUNT_POSTGRES_IMAGE:-postgres:18-alpine}');
});

test('makes the private owner backfill serializable and leaves public cutover surfaces untouched', async () => {
  const source = await readFile(join(root, 'supabase/migrations', migration), 'utf8');
  expect(source).toMatch(/begin;\nset transaction isolation level serializable;/i);
  expect(source).toMatch(/\ncommit;\s*$/i);
  for (const table of [
    'learning_state',
    'learning_events',
    'exam_sessions',
    'exam_responses',
    'earned_certifications',
    'assessment_answers',
    'roadmap_profiles',
    'migration_manifests',
    'migration_items',
    'fundamentals_unit_progress',
    'fundamentals_final_sessions',
    'dashboard_settings',
  ])
    expect(source).toContain(`public.${table}`);
  expect(source).toMatch(/from auth\.users where id = any\(owner_ids\) order by id for share nowait;/);
  expect(source).toContain('for share nowait');
  expect(source).toContain('KAQ_OWNER_SHADOW_RETRY');
  expect(source).toContain("'legacy'");
  expect(source).toContain('insert into public.learning_state');
  expect(source).toContain('if owner_ids is null then return; end if');
  expect(source).toContain('session.oauth_client_id is null');
  expect(source).toContain("amr.authentication_method = 'oauth'");
  expect(source).toContain('session.not_after is null');
  expect(source.match(/checked_at := clock_timestamp\(\);/g)?.length).toBe(2);
  expect(source.lastIndexOf('checked_at := clock_timestamp();')).toBeGreaterThan(
    source.indexOf('insert into public.learning_state'),
  );
  expect(source).toContain('member.epoch = 0');
  expect(source).toContain('member.session_fence_at is null');
  expect(source).not.toMatch(
    /alter table public\.|create function public\.|create policy|grant .*public/i,
  );
});

test('extracts the untouched DO body only inside fixture-owned transaction framing', async () => {
  const source = await readFile(join(root, 'supabase/migrations', migration));
  const start = source.indexOf(Buffer.from('do $owner_shadow$\n'));
  const end =
    source.indexOf(Buffer.from('end $owner_shadow$;'), start) + Buffer.byteLength('end $owner_shadow$;');
  const extracted = ownerShadowDo();
  expect(extracted.body).toEqual(source.subarray(start, end));
  expect(extracted.sourceHash).toMatch(/^[a-f0-9]{64}$/);
  expect(extracted.bodyHash).toMatch(/^[a-f0-9]{64}$/);
});
