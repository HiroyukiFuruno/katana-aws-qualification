import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { sql } from './commands';
import { publicState } from './public-state';
import { seedPublicData } from './seed-public';
import { artifacts } from './settings';

export async function verifySnapshotComponent() {
  const before = publicState();
  const seed = await seedPublicData();
  try {
    const proof: unknown = JSON.parse(readFileSync(`${artifacts}/smoke-proof.json`, 'utf8'));
    assert(proof && typeof proof === 'object' && 'issuers' in proof && Array.isArray(proof.issuers));
    const first: unknown = proof.issuers[0];
    assert(first && typeof first === 'object' && 'userId' in first && typeof first.userId === 'string');
    const userId = first.userId;
    assert(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(userId));
    sql(readFileSync('supabase/account-merge/learning-snapshot.sql', 'utf8'));
    const query = readFileSync('test/account-merge/learning-snapshot.sql', 'utf8')
      .replaceAll('__SEED_USER__', seed.userId)
      .replaceAll('__FIRST_USER__', userId);
    const receipt = sql(query)
      .split('\n')
      .filter((line) => line.startsWith('{'));
    assert.equal(receipt.length, 1);
    const result: unknown = JSON.parse(receipt[0]);
    assert(result && typeof result === 'object' && 'status' in result && 'checks' in result);
    assert.equal(result.status, 'passed');
    assert(Array.isArray(result.checks));
    assert(result.checks.every((check: unknown) => typeof check === 'string'));
    assert.equal(result.checks.length, 61);
    assert(result.checks.includes('presentation_columns_in_snapshot'));
    assert.equal(new Set(result.checks).size, result.checks.length);
    writeFileSync(
      `${artifacts}/learning-snapshot-proof.json`,
      JSON.stringify(
        {
          ...result,
          observedAt: new Date().toISOString(),
          populatedPublicOwnerTables: 12,
          publicApiExposed: false,
          completeAccountMergeImplemented: false,
        },
        null,
        2,
      ),
    );
    console.log(`Verified private learning snapshot: ${result.checks.length} real database checks`);
  } finally {
    await seed.cleanup();
  }
  assert.deepEqual(publicState(), before, 'Snapshot tests or cleanup changed existing public data');
}
