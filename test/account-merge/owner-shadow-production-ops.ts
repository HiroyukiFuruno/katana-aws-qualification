import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import {
  ledgerState,
  migrationFrame,
  readOnlyPreflightFrame,
  readSource,
  rows,
} from '../../scripts/owner-shadow-production';
import { contract, contractMatches } from '../../scripts/owner-shadow-production-contract';
import {
  seedCanonicalLedger,
  verifyReviewRejections,
} from '../../scripts/owner-shadow-production-review';
import { applyWithRecovery } from '../../scripts/owner-shadow-production-transport';
import { sql, sqlVerbose } from './commands';
import {
  cleanupProductionRoleFixture,
  setupProductionRoleFixture,
} from './owner-shadow-production-role';
import { ownersFromSmoke, privateRows, quoted, removeShadowRows } from './owner-shadow-support';
import { ProofConnection } from './proof-connection';
import { publicState } from './public-state';
import { artifacts } from './settings';

function preflight(sourceHash: string) {
  const output = sql(`set role postgres; ${readOnlyPreflightFrame()} reset role;`);
  const line = output.split('\n').find((value) => value.startsWith('{'));
  if (!line) throw new Error('Ops preflight returned no metadata receipt');
  const value: unknown = JSON.parse(line);
  assert(value && typeof value === 'object' && 'ledger' in value && 'contractFingerprint' in value);
  const receipt = value as {
    contract: unknown;
    contractFingerprint: unknown;
    ledger: unknown;
    role?: Record<string, unknown>;
  };
  assert.equal(receipt.role?.currentUser, 'postgres');
  assert.deepEqual(
    [
      receipt.role?.superuser,
      receipt.role?.bypassRls,
      receipt.role?.inherit,
      receipt.role?.createDb,
      receipt.role?.createRole,
    ],
    [false, true, true, true, true],
  );
  assert(
    contractMatches(receipt.contract, contract()),
    'Preflight contract inventory differs from source',
  );
  assert.equal(typeof receipt.contractFingerprint, 'string');
  return {
    fingerprint: receipt.contractFingerprint as string,
    state: ledgerState(rows(receipt.ledger), sourceHash),
  };
}

function apply(source: ReturnType<typeof readSource>, fingerprint: string) {
  sqlVerbose(`set role postgres; ${migrationFrame(source, fingerprint)} reset role;`);
}

export async function verifyOwnerShadowProductionOps() {
  assert.match(sql('show server_version_num'), /^17/, 'Ops fixture requires PostgreSQL 17');
  const source = readSource();
  const owners = ownersFromSmoke();
  const ids = owners.map((owner) => owner.userId);
  const original = publicState();
  let holder: ProofConnection | undefined;
  let configured = false;
  try {
    setupProductionRoleFixture();
    configured = true;
    const framed = publicState();
    seedCanonicalLedger();
    const before = preflight(source.sourceHash);
    assert.equal(before.state, 'pending');
    verifyReviewRejections(source, before.fingerprint, () => preflight(source.sourceHash), apply);
    const wrong = before.fingerprint === '0'.repeat(64) ? '1'.repeat(64) : '0'.repeat(64);
    assert.throws(() => apply(source, wrong), /ERROR:\s+PT409:\s+KAQ_OWNER_SHADOW_CONTRACT_DRIFT/s);
    assert.equal(preflight(source.sourceHash).state, 'pending');
    holder = await new ProofConnection().open();
    holder.send(
      `select 1 from auth.users where id=${quoted(ids[0] ?? '')} for update; select 'owner_shadow_ops_locked';`,
    );
    await holder.wait('owner_shadow_ops_locked');
    assert.throws(() => apply(source, before.fingerprint), /ERROR:\s+PT409:\s+KAQ_OWNER_SHADOW_RETRY/s);
    assert.equal(preflight(source.sourceHash).state, 'pending');
    await holder.finish();
    holder = undefined;
    const outcome = await applyWithRecovery(
      async () => preflight(source.sourceHash),
      async (fingerprint) => {
        apply(source, fingerprint);
        throw new Error('fixture transport closed after committed database frame');
      },
    );
    assert.equal(outcome, 'recovered');
    assert.equal(preflight(source.sourceHash).state, 'applied');
    assert.deepEqual(privateRows(ids), {
      accounts: ids.length,
      members: ids.length,
      grants: ids.length,
    });
    assert.deepEqual(publicState(), framed, 'Production frame changed public contract or rows');
    assert.equal(
      await applyWithRecovery(
        async () => preflight(source.sourceHash),
        async () => {},
      ),
      'noop',
    );
    writeFileSync(
      `${artifacts}/owner-shadow-production-ops.json`,
      JSON.stringify(
        {
          status: 'passed',
          postgres17Verified: true,
          sourceHash: source.sourceHash,
          rollbackRejects: ['KAQ_OWNER_SHADOW_CONTRACT_DRIFT', 'KAQ_OWNER_SHADOW_RETRY'],
          unknownTransport: 'fixture callback after actual committed DB frame; not HTTP E2E',
        },
        null,
        2,
      ),
    );
  } finally {
    await holder?.abort();
    if (configured) {
      try {
        removeShadowRows(ids);
      } finally {
        cleanupProductionRoleFixture();
      }
    }
    assert.deepEqual(publicState(), original, 'Ops fixture did not restore public metadata and rows');
  }
}
