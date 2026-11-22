import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { json, literal, sql } from '../account-sdk/sql';
import { identifiers, type ProofRacePort, snapshot } from './proof-race-state';
import { artifacts } from './settings';

type Fault = { before: string; intentId: string; legId: string; keyVersion: string };
const missingKeyVersion = 'sdk-missing-key-v1';

export function nonceCleanupFault() {
  let fault: Fault | undefined;
  return {
    beforeProofAccept: async (port: ProofRacePort) => {
      assert.equal(port.side, 'source');
      const { intent, leg } = identifiers(port);
      const before = snapshot(port.intentId);
      await port.accept();
      const accepted = json<{
        state: string;
        proofCount: string;
        intentExpiry: string;
        proofExpiry: string;
      }>(
        `select json_build_object('state',intent.state,'proofCount',(select count(*)::text from kaq_private.account_proofs proof where proof.leg_id=${leg}),
          'intentExpiry',intent.expires_at::text,'proofExpiry',proof.expires_at::text) from kaq_private.account_intents intent
          join kaq_private.account_proofs proof on proof.leg_id=${leg} where intent.id=${intent}`,
      );
      assert.equal(accepted.state, 'awaiting_target');
      assert.equal(accepted.proofCount, '1');
      assert.equal(accepted.proofExpiry, accepted.intentExpiry);
      const runtime = json<{ keyVersion: string; revision: string; nonce: string; ciphertext: string }>(
        `select json_build_object('keyVersion',encryption_key_version,'revision',revision::text,
          'nonce',encode(nonce,'hex'),'ciphertext',encode(ciphertext,'hex')) from kaq_private.account_proof_runtime where leg_id=${leg}`,
      );
      assert(runtime.keyVersion && runtime.nonce && runtime.ciphertext, 'Missing owned proof runtime');
      sql(
        `update kaq_private.account_proof_runtime set encryption_key_version=${literal(missingKeyVersion)} where leg_id=${leg}`,
      );
      const changed = json<
        typeof runtime
      >(`select json_build_object('keyVersion',encryption_key_version,'revision',revision::text,
        'nonce',encode(nonce,'hex'),'ciphertext',encode(ciphertext,'hex')) from kaq_private.account_proof_runtime where leg_id=${leg}`);
      assert.equal(changed.keyVersion, missingKeyVersion);
      assert.deepEqual({ ...changed, keyVersion: runtime.keyVersion }, runtime);
      fault = { before, intentId: port.intentId, legId: port.legId, keyVersion: runtime.keyVersion };
    },
    restore: () => {
      if (!fault) return;
      const current = fault;
      fault = undefined;
      sql(`update kaq_private.account_proof_runtime set encryption_key_version=${literal(current.keyVersion)}
        where leg_id=${literal(current.legId)}::uuid`);
      assert.equal(
        snapshot(current.intentId),
        current.before,
        'Nonce cleanup fault changed protected rows',
      );
      writeFileSync(
        `${artifacts}/proof-nonce-cleanup-fault.json`,
        `${JSON.stringify({ status: 'restored', legId: current.legId, keyVersion: current.keyVersion }, null, 2)}\n`,
      );
    },
  };
}
