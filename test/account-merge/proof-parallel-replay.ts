import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { json, sql } from '../account-sdk/sql';
import { ProofConnection } from './proof-connection';
import { identifiers, type ProofRacePort, snapshot } from './proof-race-state';
import { artifacts } from './settings';

type Canonical = {
  intentRevision: string;
  legRevision: string;
  intentExpiresAt: string;
  legExpiresAt: string;
  state: string;
  legState: string;
  proofCount: string;
};

function canonical(port: ProofRacePort): Canonical {
  const { intent, leg } = identifiers(port);
  return json<Canonical>(`select json_build_object('intentRevision',intent.revision::text,
    'legRevision',leg.revision::text,'intentExpiresAt',intent.expires_at::text,'legExpiresAt',leg.expires_at::text,
    'state',intent.state,'legState',leg.state,'proofCount',(select count(*)::text from kaq_private.account_proofs proof
      where proof.leg_id=${leg})) from kaq_private.account_intents intent
    join kaq_private.account_proof_legs leg on leg.id=${leg} where intent.id=${intent}`);
}

function assertAdvanced(before: Canonical, after: Canonical) {
  assert.equal(after.state, 'awaiting_target');
  assert.equal(after.legState, 'proved');
  assert.equal(after.proofCount, '1');
  assert.equal(BigInt(after.intentRevision), BigInt(before.intentRevision) + 1n);
  assert.equal(BigInt(after.legRevision), BigInt(before.legRevision) + 1n);
  assert.equal(after.intentExpiresAt, before.intentExpiresAt);
  assert.equal(after.legExpiresAt, before.legExpiresAt);
}

export async function verifyParallelProofReplay(port: ProofRacePort) {
  assert.equal(port.side, 'source');
  const { intent } = identifiers(port);
  const before = snapshot(port.intentId);
  const initial = canonical(port);
  const holder = await new ProofConnection().open();
  let first: Promise<void> | undefined;
  let second: Promise<void> | undefined;
  try {
    holder.send(
      `select 1 from kaq_private.account_intents where id=${intent} for update; select 'intent_locked';`,
    );
    await holder.wait('intent_locked');
    first = port.accept();
    const intentGraph = await holder.blocked();
    const firstPid = intentGraph[0]?.waiter;
    assert(Number.isInteger(firstPid) && firstPid > 0, 'Missing first proof backend PID');
    assert.equal(
      sql(
        `select exists(select 1 from pg_locks where pid=${firstPid} and locktype='advisory' and granted)`,
      ),
      't',
    );
    second = port.accept();
    const advisoryGraph = await holder.blocked(firstPid);
    const secondPid = advisoryGraph[0]?.waiter;
    assert(Number.isInteger(secondPid) && secondPid > 0, 'Missing replay proof backend PID');
    assert.equal(
      sql(
        `select exists(select 1 from pg_locks where pid=${secondPid} and locktype='advisory' and not granted)`,
      ),
      't',
    );
    await holder.finish();
    await Promise.all([first, second]);
    const after = canonical(port);
    assertAdvanced(initial, after);
    assert.equal(snapshot(port.intentId), before, 'Parallel replay changed rows outside its own proof');
    const result = { intentGraph, advisoryGraph, firstPid, secondPid, initial, after };
    writeFileSync(
      `${artifacts}/proof-parallel-replay.json`,
      `${JSON.stringify({ status: 'passed', result, signedHttp: true }, null, 2)}\n`,
    );
  } finally {
    await holder.abort();
    await Promise.all(
      [first, second].filter((attempt): attempt is Promise<void> => attempt !== undefined),
    );
  }
}
