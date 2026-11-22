import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync('supabase/account-merge/preview-authority.sql', 'utf8');
const wrapper = readFileSync('test/account-merge/preview-wrapper.sql', 'utf8');
const proofSchema = readFileSync('supabase/account-merge/proof-schema.sql', 'utf8');
const http = readFileSync('test/account-sdk/intent-scope-http.ts', 'utf8');

test('preview authority accepts only the locked intent capability and invokes scope once', () => {
  assert.match(
    source,
    /prepare_account_merge_preview\(\s*\n?\s*p_intent_id uuid, p_intent_secret text, p_expected_revision bigint/,
  );
  assert.doesNotMatch(source, /p_(?:actor|target|account|session|uid)/);
  assert.equal((source.match(/lock_account_intent_scope\(/g) ?? []).length, 1);
  assert.match(source, /where id = intent\.id and revision = p_expected_revision/);
  assert.match(source, /state = 'previewed', revision = revision \+ 1/);
});

test('preview materializes combined and source v2 snapshots in one SQL statement', () => {
  assert.match(
    source,
    /with input as materialized[\s\S]*combined_snapshot as materialized[\s\S]*per_source as materialized/,
  );
  assert.match(source, /capture_merge_snapshot_v2\(ids\)/);
  assert.match(source, /capture_merge_snapshot_v2\(array\[account_id\]\)/);
  assert.match(source, /preview_digest = decode\(digest, 'hex'\)/);
  assert.match(source, /least\(intent\.expires_at, clock_timestamp\(\) \+ interval '2 minutes'/);
  assert.match(source, /revoke all on function kaq_private\.prepare_account_merge_preview/);
});

test('signed fixture returns only the nonidentifying preview envelope', () => {
  for (const key of [
    'preview_id',
    'revision',
    'digest',
    'expires_at',
    'existing_account_count',
    'membership_count',
  ])
    assert.match(wrapper, new RegExp(`'${key}'`));
  assert.doesNotMatch(wrapper, /'document'|'scope'|'memberships'|'uid'|'fence'/);
  assert.match(wrapper, /revoke all[\s\S]*grant execute[\s\S]*to authenticated/);
});

test('preview fixture records only its signed response when a native assertion fails', () => {
  const fixture = readFileSync('test/account-sdk/preview-authority.pw.ts', 'utf8');
  assert.match(
    fixture,
    /expect\(accepted, JSON\.stringify\(accepted\)\)\.toMatchObject\(\{ status: 200 \}\)/,
  );
  assert.match(
    fixture,
    /expect\(refreshed, JSON\.stringify\(refreshed\)\)\.toMatchObject\(\{ status: 200 \}\)/,
  );
});

test('auth-only target may become previewed only after both proofs, and unexpected database detail is hidden', () => {
  assert.match(
    proofSchema,
    /kind = 'merge_existing'[\s\S]*target_account_id is null[\s\S]*state in \('both_proved', 'previewed', 'cancelled', 'expired'\)/,
  );
  assert.match(
    wrapper,
    /get stacked diagnostics failure_code = returned_sqlstate, failure_message = message_text/,
  );
  assert.match(wrapper, /errcode = 'PT500', message = 'KAQ_PREVIEW_UNEXPECTED'/);
  assert.doesNotMatch(http, /KAQ_PREVIEW_UNEXPECTED/);
  const fixture = readFileSync('test/account-sdk/preview-authority.pw.ts', 'utf8');
  assert.match(fixture, /create trigger fixture_preview_private_marker before update/);
  assert.match(fixture, /const boundary = await prepareScopePreview\(/);
  assert.match(
    http,
    /const responseBody: unknown = await response\.json\(\);\s*return \{ status: response\.status, body: responseBody \}/,
  );
  assert.match(fixture, /drop trigger if exists fixture_preview_private_marker/);
  assert.doesNotMatch(fixture, /fixture_preview_error_boundary/);
});

test('preview native suite includes a lower-lock state-barrier regression', () => {
  const race = readFileSync('test/account-sdk/preview-authority-races.pw.ts', 'utf8');
  assert.match(race, /rejectScopeAfterStateBarrier/);
  assert.match(race, /KAQ_INTENT_SCOPE_RETRY/);
  assert.match(race, /auth-only attach/);
  assert.match(race, /source existing target auth-only/);
  assert.match(race, /both existing owners/);
  assert.match(race, /coalesce\(intent\.source_account_id,intent\.target_account_id\)/);
});
