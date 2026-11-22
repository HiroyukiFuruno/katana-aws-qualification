import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { json, literal, sql } from '../account-sdk/sql';
import { ProofConnection } from './proof-connection';
import { identifiers, type ProofRacePort, snapshot } from './proof-race-state';
import { artifacts } from './settings';

export async function verifyProofAuthDeleteRace(port: ProofRacePort) {
  const { intent, leg } = identifiers(port);
  const actor = json<{ uid: string; account: string }>(`select json_build_object(
    'uid',actor_uid,'account',source_account_id) from kaq_private.account_intents where id=${intent}`);
  assert(actor.account && actor.uid);
  const protectedBefore = snapshot(port.intentId);
  const frozen = () =>
    sql(`select json_build_object('intent',to_jsonb(intent)-array['state','revision','target_uid',
      'target_account_id','target_membership_epoch'],'legs',
      (select json_agg(to_jsonb(item)-array['state','revision'] order by item.id)
       from kaq_private.account_proof_legs item where item.intent_id=intent.id),
      'proofs',(select coalesce(json_agg(to_jsonb(item) order by item.id),'[]')
       from kaq_private.account_proofs item where item.intent_id=intent.id and item.leg_id<>${leg}))
      from kaq_private.account_intents intent where intent.id=${intent}`);
  const unchangedFields = frozen();
  const revision = sql(`select revision from kaq_private.account_proof_legs where id=${leg}`);
  const holder = await new ProofConnection().open();
  const deletion = await new ProofConnection().open();
  let attempt: Promise<{ ok: boolean }> | undefined;
  try {
    holder.send(`select 1 from public.learning_state where user_id=${literal(actor.account)}::uuid
      for update; select 'state_locked';`);
    await holder.wait('state_locked');
    attempt = port.accept().then(
      () => ({ ok: true }),
      () => ({ ok: false }),
    );
    const stateGraph = await holder.blocked();
    assert.equal(stateGraph.length, 1);
    deletion.send(`delete from auth.users where id=${literal(actor.uid)}::uuid;
      select 'delete_uncommitted';`);
    const deletionGraph = await deletion.blocked(stateGraph[0].waiter, deletion.pid);
    await holder.finish();
    assert.equal((await attempt).ok, true, 'Signed HTTP proof acceptance failed');
    await deletion.wait('delete_uncommitted');
    await deletion.finish();
    assert.equal(snapshot(port.intentId), protectedBefore);
    assert.equal(frozen(), unchangedFields);
    assert.equal(sql(`select count(*) from kaq_private.account_proofs where leg_id=${leg}`), '1');
    assert.equal(
      sql(`select state='proved' and revision=${literal(revision)}::bigint+1
        from kaq_private.account_proof_legs where id=${leg}`),
      't',
    );
    writeFileSync(
      `${artifacts}/proof-${port.side}-auth-delete-race.json`,
      `${JSON.stringify(
        {
          status: 'passed',
          stateGraph,
          deletionGraph,
          signedHttpAcceptance: true,
          authRowDeletionRolledBack: true,
          protectedRowsUnchanged: true,
          proofRows: 1,
          deadlocks: 0,
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    await holder.abort();
    await deletion.abort();
    if (attempt) await attempt;
  }
}
