import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const source = (name: string) =>
  readFileSync(new URL(`../supabase/account-merge/public-${name}.sql`, import.meta.url), 'utf8');

test('public writer proposal uses the shared committed-proof grant validator', () => {
  const sql = source('writer-scope');
  expect(sql).toContain('current_grant := kaq_private.resolve_current_learning_grant()');
  expect(sql).not.toContain('live_session.created_at <= fence_at');
  expect(sql.indexOf('for share nowait')).toBeLessThan(sql.indexOf('current_grant := '));
  expect(sql).toContain('KAQ_SCOPE_REENTRY');
});
test('nested scope cache is transaction-local, context-bound, and forbids a writer lock upgrade', () => {
  const sql = source('scope-cache');
  expect(sql).toContain("cached->>'txid' is distinct from pg_current_xact_id()::text");
  expect(sql).toContain("cached->'context' is distinct from context");
  expect(sql).toContain('KAQ_SCOPE_MODE_UPGRADE');
  expect(sql).toContain("'context',context,'scope',scope)::text, true)");
  expect(sql).toContain('generation is distinct from p_expected_generation');
});
test('readers delegate to the same grant validation and bootstrap has no creation side effect', () => {
  const sql = source('read-scope');
  expect(sql.match(/resolve_current_learning_grant\(\)/g)).toHaveLength(2);
  expect(sql.match(/lock_request_context\(\)/g)).toHaveLength(2);
  expect(sql).toContain("(context->>'expected_account')::uuid is distinct from account.id");
  expect(sql).toContain('KAQ_ACCOUNT_STATE_MISSING');
  expect(sql).not.toMatch(/insert into|update public|initialize_learning_state/i);
});
