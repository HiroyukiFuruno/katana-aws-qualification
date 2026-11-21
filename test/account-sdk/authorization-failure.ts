import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { type Operation, reply } from './control-fixture';
import { actorJson, literal, requiredUuid, sql } from './sql';

export const maximumSafeInteger = 9_007_199_254_740_991;

export type AuthorizationFailure = {
  legId: string;
  legRevision: number;
  runtimeRevision: number;
  expiresAt: number;
  nextLegId: string;
  nextAttempt: number;
  nextState: string;
};

export function injectRuntimeRevisionOverflow(legId: string) {
  const updated = sql(
    `update kaq_private.account_proof_runtime set revision=${maximumSafeInteger} where leg_id=${literal(legId)}::uuid and revision=0 returning revision;`,
  );
  if (updated !== String(maximumSafeInteger)) throw new Error('authorization failure injection failed');
}

export function verifyAuthorizationFailure(operations: Map<string, Operation>): AuthorizationFailure {
  const operation = [...operations.values()].find((item) => item.claimId);
  if (!operation?.intent || !operation.legId) throw new Error('missing authorization failure operation');
  const current = actorJson<{
    intent_revision: number;
    leg_state: string;
    leg_revision: number;
    runtime_revision: number;
    expires_at: number;
  }>(
    operation.actor,
    `select json_build_object('intent_revision',intent.revision,'leg_state',leg.state,'leg_revision',leg.revision,'runtime_revision',runtime.revision,'expires_at',kaq_private.runtime_epoch_ms(leg.expires_at))::text from kaq_private.account_intents intent join kaq_private.account_proof_legs leg on leg.intent_id=intent.id join kaq_private.account_proof_runtime runtime on runtime.leg_id=leg.id where intent.id=${literal(operation.intent.id)}::uuid and leg.id=${literal(operation.legId)}::uuid;`,
  );
  if (
    current.leg_state !== 'failed' ||
    current.leg_revision !== 2 ||
    current.runtime_revision !== maximumSafeInteger ||
    !Number.isSafeInteger(current.expires_at)
  )
    throw new Error('authorization failure was not persisted with the current revision');
  const nonceHash = createHash('sha256').update(randomBytes(32)).digest('hex');
  const next = reply(
    operation.actor,
    `select kaq_private.issue_account_leg(${literal(operation.intent.id)}::uuid,${literal(operation.intent.secret)},'source',${current.intent_revision},${literal(randomUUID())}::uuid,decode(${literal(nonceHash)},'hex'),false)::text;`,
  );
  if (next.leg_state !== 'issued' || next.leg_id === operation.legId || next.attempt !== 2)
    throw new Error('authorization failure next leg was not issued');
  return {
    legId: requiredUuid(operation.legId),
    legRevision: current.leg_revision,
    runtimeRevision: current.runtime_revision,
    expiresAt: current.expires_at,
    nextLegId: requiredUuid(next.leg_id),
    nextAttempt: next.attempt,
    nextState: next.leg_state,
  };
}
