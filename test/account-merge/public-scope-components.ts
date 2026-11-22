import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sql } from './commands';

const functions = [
  'fixture_read_public_learning_scope()',
  'fixture_read_account_bootstrap()',
  'fixture_open_public_learning_scope(text,bigint)',
  'fixture_nested_public_learning_scope(text,text,bigint)',
  'fixture_public_learning_scope_cache_probe()',
] as const;
const replaced = [
  'kaq_private.lock_learning_scope(text,bigint,uuid[],uuid[])',
  'kaq_private.read_learning_account()',
  'kaq_private.read_account_bootstrap()',
] as const;
let before = new Map<string, string>();
let fingerprint = '';

function catalogFingerprint() {
  return sql(`select md5(coalesce(jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,
    'definition',pg_get_functiondef(p.oid),'acl',p.proacl) order by p.oid::regprocedure::text),'[]')::text)
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='kaq_private'`);
}

export function installPublicScopeFixture() {
  fingerprint = catalogFingerprint();
  before = new Map(
    replaced.map((name) => [name, sql(`select pg_get_functiondef('${name}'::regprocedure)`)]),
  );
  try {
    for (const name of ['public-writer-scope.sql', 'public-scope-cache.sql', 'public-read-scope.sql'])
      sql(readFileSync(`supabase/account-merge/${name}`, 'utf8'));
    sql(readFileSync('test/account-merge/public-scope-wrapper.sql', 'utf8'));
    for (const name of functions)
      assert.equal(
        sql(`select has_function_privilege('authenticated','public.${name}','EXECUTE')`),
        't',
      );
  } catch (error) {
    removePublicScopeFixture();
    throw error;
  }
}

export function removePublicScopeFixture() {
  if (!fingerprint) return;
  sql(`drop function if exists public.fixture_read_public_learning_scope();
    drop function if exists public.fixture_read_account_bootstrap();
    drop function if exists public.fixture_open_public_learning_scope(text,bigint);
    drop function if exists public.fixture_nested_public_learning_scope(text,text,bigint);
    drop function if exists public.fixture_public_learning_scope_cache_probe()`);
  for (const name of replaced) sql(before.get(name) ?? '');
  sql('drop function if exists kaq_private.open_public_learning_scope(text,bigint)');
  sql('drop function if exists kaq_private.read_public_learning_scope()');
  assert.equal(
    catalogFingerprint(),
    fingerprint,
    'Public scope fixture changed private function catalog',
  );
  for (const name of functions)
    assert.equal(sql(`select to_regprocedure('public.${name}') is null`), 't');
  before = new Map();
  fingerprint = '';
}
