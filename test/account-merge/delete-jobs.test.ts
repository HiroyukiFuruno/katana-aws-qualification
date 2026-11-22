import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync('supabase/account-merge/delete-jobs.sql', 'utf8');
const wrapper = readFileSync('test/account-merge/delete-jobs-wrapper.sql', 'utf8');

test('delete jobs have no Auth or logical-account cascade foreign keys', () => {
  assert.doesNotMatch(
    source,
    /account_delete_job(?:s|_targets)[\s\S]{0,500}references\s+(?:auth\.users|kaq_private\.learning_(?:accounts|memberships))/i,
  );
  assert.match(source, /references kaq_private\.account_delete_jobs\(id\) on delete cascade/);
});

test('delete jobs claim selectorlessly and bind all mutations to a live lease', () => {
  assert.match(source, /claim_account_delete_job\(\) returns table/);
  for (const name of [
    'next_account_delete_target',
    'confirm_account_delete_target_absent',
    'defer_account_delete_job',
    'complete_account_delete_job',
  ])
    assert.match(source, new RegExp(`${name}[\\s\\S]*lease_id`));
  assert.match(
    source,
    /account\.status = 'deleting'[\s\S]*session_fence_at is not distinct from job\.scope_fence_at/,
  );
  assert.match(source, /member\.account_id <> job\.scope_account_id/);
  assert.doesNotMatch(source, /p_confirming_absent_uid/);
  assert.match(source, /account_delete_scope_current\(job\.id\)/);
  assert.match(source, /content_erased_at is null/);
  assert.match(source, /member\.auth_user_id is null and exists\(select 1 from auth\.users auth_user/);
  assert.match(source, /not found or exists\(select 1 from auth\.users auth_user/);
});

test('delete jobs keep anchor last, cap backoff, and leave only a minimal receipt', () => {
  assert.match(source, /not target\.is_anchor or not exists/);
  assert.match(source, /least\(3600, power\(2, least\(retry_count \+ 1, 12\)\)/);
  assert.match(source, /insert into kaq_private\.account_delete_receipts/);
  assert.match(source, /delete from kaq_private\.account_delete_jobs/);
  assert.match(source, /then 'completed' else 'unknown'/);
  assert.match(source, /p_reason is null or p_reason not in/);
  for (const table of ['account_delete_jobs', 'account_delete_job_targets', 'account_delete_receipts'])
    assert.match(source, new RegExp(`alter table kaq_private\\.${table} enable row level security`));
  assert.match(
    source,
    /exists\(select 1 from kaq_private\.account_delete_job_targets target[\s\S]*join auth\.users auth_user/,
  );
});

test('only the fixture wrapper exposes fixed private calls to service_role', () => {
  assert.match(wrapper, /fixture_claim_account_delete_job\(\)/);
  assert.match(wrapper, /grant execute[\s\S]*to service_role/);
  assert.doesNotMatch(wrapper, /(?:insert|update|delete)\s+into\s+kaq_private\.account_delete/i);
  assert.match(source, /revoke all on function[\s\S]*kaq_private\.claim_account_delete_job\(\)/);
});
