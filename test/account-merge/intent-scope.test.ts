import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync('supabase/account-merge/intent-scope.sql', 'utf8');

test('intent scope accepts no caller-selected owner identifiers', () => {
  assert.match(
    source,
    /lock_account_intent_scope\(\s*\n?\s*p_intent_id uuid, p_intent_secret text, p_expected_revision bigint/,
  );
  assert.doesNotMatch(source, /p_(?:actor|target|account|session|uid)/);
});

test('intent scope fixes advisory-to-lower lock order and keeps private ACL closed', () => {
  assert.match(source, /pg_advisory_xact_lock[\s\S]*account_intents[\s\S]*for update/);
  assert.match(source, /auth\.users[\s\S]*for share[\s\S]*auth\.sessions[\s\S]*for share nowait/);
  assert.match(source, /learning_state[\s\S]*for update[\s\S]*learning_accounts[\s\S]*for update/);
  assert.match(
    source,
    /perform 1 from kaq_private\.account_proofs[\s\S]*for share;[\s\S]*select jsonb_agg/,
  );
  assert.doesNotMatch(source, /select jsonb_agg[\s\S]{0,500}for share;/);
  assert.match(source, /revoke all on function kaq_private\.lock_account_intent_scope/);
});

test('intent scope rejects stale membership, proof, expiry, and reentry', () => {
  for (const code of [
    'KAQ_INTENT_SCOPE_REENTRY',
    'KAQ_INTENT_STALE',
    'KAQ_INTENT_EXPIRED',
    'KAQ_INTENT_SCOPE_RETRY',
  ])
    assert.match(source, new RegExp(code));
  assert.match(source, /current_proofs is distinct from proof_rows/);
  assert.match(source, /current_member_uids is distinct from discovered_member_uids/);
  assert.match(
    source,
    /expires_at from kaq_private\.account_intents where id = intent\.id\) <= clock_timestamp/,
  );
  assert.match(source, /KAQ_SAME_ACCOUNT/);
  assert.match(source, /current_generations is distinct from initial_generations/);
});

test('intent scope rechecks the discovered UID set after all lower locks', () => {
  assert.match(
    source,
    /learning_session_grants where account_id = any\(account_ids\) order by session_id for update[\s\S]*into current_members[\s\S]*jsonb_array_elements\(coalesce\(current_members[\s\S]*current_member_uids is distinct from discovered_member_uids/,
  );
});

test('intent scope binds both proof freshness records and retains inactive co-members in its snapshot', () => {
  for (const field of [
    'session_created_at',
    'oauth_at',
    'consumed_at',
    'leg_issued_at',
    'leg_expires_at',
    'leg_state',
  ])
    assert.match(source, new RegExp(`'${field}'`));
  assert.match(
    source,
    /auth\.mfa_amr_claims[\s\S]*session_id = any\(session_ids\)[\s\S]*for share nowait/,
  );
  assert.match(source, /oauth_amr\.updated_at is distinct from \(proof ->> 'oauth_at'\)::timestamptz/);
  assert.match(source, /proof ->> 'leg_state' <> 'proved'/);
  assert.match(source, /proof ->> 'consumed_at' is not null/);
  assert.match(
    source,
    /into current_members from kaq_private\.learning_memberships where account_id = any/,
  );
  assert.doesNotMatch(source, /into current_members[\s\S]{0,180}status = 'active'/);
});

test('intent scope locks every existing-account grant and returns only a nonidentifying member count', () => {
  assert.match(
    source,
    /learning_session_grants where account_id = any\(account_ids\) order by session_id for update/,
  );
  assert.match(source, /initial_main_grant/);
  assert.match(source, /current_main_grant/);
  assert.match(source, /current_main_grant is distinct from initial_main_grant/);
  assert.match(source, /'membership_count'/);
  assert.doesNotMatch(source, /'memberships',current_members/);
});
