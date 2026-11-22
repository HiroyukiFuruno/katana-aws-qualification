import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { dataMigrations } from '../../scripts/data-migrations';
import { sql } from './commands';
import { publicState } from './public-state';
import { artifacts } from './settings';

// binding表の追加後は、その全行不変検査も既存148条件に加わる。
const hasCommittedBindings = dataMigrations.includes('202611220003_learning_session_grants.sql');
const hasCreationReceipts = dataMigrations.includes('202611220004_learning_account_creation.sql');
const components = [
  ['session-resolver', 71],
  ['owner-scope', hasCommittedBindings ? (hasCreationReceipts ? 150 : 149) : 148],
  ['bootstrap', 31],
  ['private-acl', 7],
] as const;

export function verifyScopeComponents(mode: 'session' | 'acl' = 'session', installed = false) {
  const fixture: unknown = JSON.parse(readFileSync(`${artifacts}/smoke-proof.json`, 'utf8'));
  assert(fixture && typeof fixture === 'object' && 'issuers' in fixture);
  assert(Array.isArray(fixture.issuers) && fixture.issuers.length === 2);
  const identifiers = fixture.issuers.flatMap((issuer: unknown) => {
    assert(issuer && typeof issuer === 'object' && 'userId' in issuer && 'sessionId' in issuer);
    const { userId, sessionId } = issuer;
    assert(typeof userId === 'string' && typeof sessionId === 'string');
    assert([userId, sessionId].every((id) => /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(id)));
    return [userId, sessionId];
  });
  assert.equal(new Set(identifiers).size, 4, 'Require distinct actual OAuth users and sessions');
  const before = publicState();
  for (const [component, expectedCount] of components) {
    if ((component === 'private-acl') !== (mode === 'acl')) continue;
    // 非公開SQL部品を専用DBだけに適用し、実sessionの入力回帰は各transactionで巻き戻す。
    if (component !== 'private-acl' && !installed)
      sql(readFileSync(`supabase/account-merge/${component}.sql`, 'utf8'));
    const query = readFileSync(`test/account-merge/${component}.sql`, 'utf8')
      .replaceAll('__FIRST_USER__', identifiers[0])
      .replaceAll('__FIRST_SESSION__', identifiers[1])
      .replaceAll('__SECOND_USER__', identifiers[2])
      .replaceAll('__SECOND_SESSION__', identifiers[3]);
    const receipt = sql(query)
      .split('\n')
      .filter((line) => line.startsWith('{'));
    assert.equal(receipt.length, 1, `Require one ${component} verification receipt`);
    const result: unknown = JSON.parse(receipt[0]);
    assert(result && typeof result === 'object' && 'status' in result && 'checks' in result);
    assert.equal(result.status, 'passed');
    assert(Array.isArray(result.checks));
    assert(result.checks.every((check: unknown) => typeof check === 'string'));
    assert.equal(result.checks.length, expectedCount);
    assert.equal(new Set(result.checks).size, expectedCount, 'Do not count duplicated checks');
    if (component === 'owner-scope' && hasCommittedBindings)
      assert(result.checks.includes('unchanged_kaq_private_account_committed_proof_bindings'));
    if (component === 'owner-scope' && hasCreationReceipts)
      assert(result.checks.includes('unchanged_kaq_private_learning_account_creation_receipts'));
    assert.deepEqual(publicState(), before, `${component} changed public schema or data`);
    writeFileSync(
      `${artifacts}/${component}-proof.json`,
      JSON.stringify(
        {
          ...result,
          observedAt: new Date().toISOString(),
          publicDataUnchanged: true,
          realOidcIssuers: 2,
          publicApiExposed: false,
          completeAccountMergeImplemented: false,
        },
        null,
        2,
      ),
    );
    console.log(`Verified private ${component}: ${expectedCount} real database checks`);
  }
}
