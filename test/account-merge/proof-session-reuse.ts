import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { hex, reply, sourceIntent } from '../account-sdk/control-fixture';
import { FixtureProofError } from '../account-sdk/proof-acceptance';
import type { ProofRacePort } from '../account-sdk/proof-port';
import { type Actor, actorSql, json, literal, sql } from '../account-sdk/sql';
import { snapshot } from './proof-race-state';

type Stage = { intentId: string; legId: string; nonce: string; revision: number; actor: Actor };
type Rows = Record<string, string>;
type Result = { status: number; code: string; message: string };
const sessionReuseMessage =
  'duplicate key value violates unique constraint "account_proofs_session_id_key"';

function stage(actor: Actor): Stage {
  const intent = sourceIntent(actor);
  const nonce = randomBytes(32).toString('hex');
  const nonceBytes = Buffer.from(nonce, 'hex');
  const nonceHash = createHash('sha256').update(nonceBytes).digest();
  assert.equal(nonceBytes.length, 32, 'Invalid staged nonce bytes');
  assert.equal(nonceHash.length, 32, 'Invalid staged nonce hash');
  const issued = reply(
    actor,
    `select kaq_private.issue_account_leg(${literal(intent.id)}::uuid,${literal(intent.secret)},'source',${intent.version},
      ${literal(randomUUID())}::uuid,decode(${literal(hex(nonceHash))},'hex'))::text;`,
  );
  assert(issued.leg_id && Number.isSafeInteger(issued.leg_revision), 'Unable to stage reuse leg');
  actorSql(
    actor,
    `update kaq_private.account_proof_legs set state='exchanged' where id=${literal(issued.leg_id)}::uuid;
    update kaq_private.account_intents set state='cancelled' where id=${literal(intent.id)}::uuid;`,
  );
  return { intentId: intent.id, legId: issued.leg_id, nonce, revision: issued.leg_revision, actor };
}

function rows(port: ProofRacePort, staged: Stage): Rows {
  return json<Rows>(`select json_build_object('originalState',original.state,'originalRevision',original.revision::text,
    'originalExpiry',original.expires_at::text,'originalLegState',original_leg.state,'originalLegRevision',original_leg.revision::text,
    'originalLegExpiry',original_leg.expires_at::text,'stageState',stage.state,'stageRevision',stage.revision::text,
    'stageExpiry',stage.expires_at::text,'legState',leg.state,'legRevision',leg.revision::text,'legExpiry',leg.expires_at::text)
    from kaq_private.account_intents original join kaq_private.account_intents stage on stage.id=${literal(staged.intentId)}::uuid
    join kaq_private.account_proof_legs leg on leg.id=${literal(staged.legId)}::uuid
    join kaq_private.account_proof_legs original_leg on original_leg.id=${literal(port.legId)}::uuid
    where original.id=${literal(port.intentId)}::uuid`);
}

function activate(port: ProofRacePort, staged: Stage) {
  actorSql(
    staged.actor,
    `update kaq_private.account_intents set state='cancelled' where id=${literal(port.intentId)}::uuid;
    update kaq_private.account_intents set state='awaiting_source' where id=${literal(staged.intentId)}::uuid;`,
  );
}

function restore(port: ProofRacePort, staged: Stage, prior: Rows) {
  actorSql(
    staged.actor,
    `update kaq_private.account_intents set state=${literal(prior.stageState)},revision=${literal(prior.stageRevision)}::bigint,
    expires_at=${literal(prior.stageExpiry)}::timestamptz where id=${literal(staged.intentId)}::uuid;
    update kaq_private.account_proof_legs set state=${literal(prior.legState)},revision=${literal(prior.legRevision)}::bigint,
    expires_at=${literal(prior.legExpiry)}::timestamptz where id=${literal(staged.legId)}::uuid;
    update kaq_private.account_intents set state=${literal(prior.originalState)},revision=${literal(prior.originalRevision)}::bigint,
    expires_at=${literal(prior.originalExpiry)}::timestamptz where id=${literal(port.intentId)}::uuid;`,
  );
}

function proofCount(legId: string) {
  return sql(`select count(*) from kaq_private.account_proofs where leg_id=${literal(legId)}::uuid`);
}

export function proofSessionReuseFixture(actor: Actor) {
  const staged = stage(actor);
  let result: Result | undefined;
  return {
    beforeProofAccept: async (port: ProofRacePort) => {
      assert.equal(port.side, 'source');
      assert.equal(port.proofAuthUid, staged.actor.userId);
      await port.accept();
      const before = snapshot(port.intentId);
      const prior = rows(port, staged);
      let activated = false;
      try {
        activate(port, staged);
        activated = true;
        const ready = json<Record<string, boolean | string>>(`select json_build_object(
          'valid',stage.actor_uid=${literal(staged.actor.userId)}::uuid and stage.actor_session_id=${literal(staged.actor.sessionId)}::uuid
            and stage.state='awaiting_source' and leg.state='exchanged' and leg.expected_uid=stage.actor_uid
            and leg.revision=${staged.revision} and extensions.digest(decode(${literal(staged.nonce)},'hex'),'sha256')=leg.ingest_nonce_hash
            and proof_session.created_at>leg.issued_at and proof_session.id<>stage.actor_session_id
            and (proof_session.not_after is null or proof_session.not_after>clock_timestamp())
            and exists(select 1 from auth.mfa_amr_claims amr where amr.session_id=proof_session.id
              and amr.authentication_method='oauth' and amr.updated_at>=leg.issued_at and amr.updated_at<=clock_timestamp()+interval '5 seconds')
            and not exists(select 1 from kaq_private.learning_memberships where auth_user_id=stage.actor_uid),
          'proofExpiry',proof.expires_at::text,'intentExpiry',original.expires_at::text)
          from kaq_private.account_intents stage join kaq_private.account_proof_legs leg on leg.id=${literal(staged.legId)}::uuid
          join kaq_private.account_intents original on original.id=${literal(port.intentId)}::uuid
          join kaq_private.account_proofs proof on proof.leg_id=${literal(port.legId)}::uuid
          join auth.sessions proof_session on proof_session.id=${literal(port.proofSessionId)}::uuid where stage.id=${literal(staged.intentId)}::uuid`);
        assert.equal(ready.valid, true, 'Reuse fixture did not reach global-session guard');
        assert.equal(ready.proofExpiry, ready.intentExpiry);
        let rejection: FixtureProofError | undefined;
        try {
          await port.acceptReuse({
            intentId: staged.intentId,
            legId: staged.legId,
            ingestNonce: staged.nonce,
            expectedLegRevision: staged.revision,
          });
        } catch (error) {
          if (error instanceof FixtureProofError) rejection = error;
          else throw error;
        }
        assert(rejection, 'Reused proof session was accepted');
        assert.equal(rejection.status, 409);
        assert.equal(rejection.code, '23505');
        assert.equal(rejection.message, sessionReuseMessage);
        assert.equal(proofCount(staged.legId), '0');
        assert.equal(proofCount(port.legId), '1');
        result = { status: rejection.status, code: rejection.code, message: rejection.message };
      } finally {
        if (activated) restore(port, staged, prior);
        assert.deepEqual(rows(port, staged), prior);
        assert.equal(snapshot(port.intentId), before, 'Session reuse rejection changed protected rows');
      }
    },
    result: () =>
      result ??
      (() => {
        throw new Error('session reuse was not checked');
      })(),
    cleanup: () =>
      sql(`delete from kaq_private.account_intents where id=${literal(staged.intentId)}::uuid;`),
  };
}
