import { randomUUID } from 'node:crypto';
import type { ServerSdkLeg } from '../../supabase/functions/account-linking/server/sdk-worker.types.ts';
import { type Actor, actorJson, literal } from './sql';

type Reply = {
  intent_id: string;
  intent_state: string;
  intent_revision: number;
  leg_id: string;
  leg_state: string;
  leg_revision: number;
  attempt?: number;
  guard: ServerSdkLeg['runtime'];
  authorization_prepared?: boolean;
  claimed?: boolean;
  claim_id?: string;
};
type BeginReply = { id: string; secret: string; version: number };
export type Intent = { id: string; secret: string; version: number };
export type Operation = {
  actor: Actor;
  side: 'source' | 'target';
  intent?: Intent;
  legId?: string;
  nonceHash?: Uint8Array;
  claimId?: string;
};

export function hex(value: Uint8Array) {
  return Buffer.from(value).toString('hex');
}
export function reply(actor: Actor, statement: string) {
  return actorJson<Reply>(actor, statement);
}
export function leg(operation: Operation): ServerSdkLeg {
  if (!operation.intent || !operation.legId || !operation.nonceHash)
    throw new Error('SDK operation is incomplete');
  const value = actorJson<Reply>(
    operation.actor,
    `select kaq_private.authorization_control_result(intent,proof,false,false)::text from kaq_private.account_intents intent join kaq_private.account_proof_legs proof on proof.intent_id=intent.id where intent.id=${literal(operation.intent.id)}::uuid and proof.id=${literal(operation.legId)}::uuid;`,
  );
  if (value.leg_id !== operation.legId || value.intent_id !== operation.intent.id || !value.guard)
    throw new Error('SDK leg binding failed');
  return {
    id: value.leg_id,
    state: value.leg_state,
    revision: value.leg_revision,
    intentState: value.intent_state,
    expiresAt: value.guard.expiresAt,
    provider: operation.side === 'source' ? 'keycloak' : 'azure',
    runtime: value.guard,
    nonceHash: operation.nonceHash,
    side: operation.side,
    active: ['awaiting_source', 'awaiting_target'].includes(value.intent_state),
    authorizationPrepared: value.authorization_prepared === true,
    ...(operation.side === 'source' ? { expectedAuthUid: operation.actor.userId } : {}),
  };
}
export function sourceIntent(actor: Actor): Intent {
  const value = actorJson<BeginReply>(
    actor,
    `select kaq_private.begin_account_intent('add_existing',${literal(randomUUID())}::uuid,false)::text;`,
  );
  if (!value.id || !value.secret || !Number.isSafeInteger(value.version))
    throw new Error('SDK source intent failed');
  return { id: value.id, secret: value.secret, version: value.version };
}
export function targetIntent(actor: Actor, operations: Map<string, Operation>): Intent {
  const source = [...operations.values()].find(
    (item) =>
      item.side === 'source' &&
      item.actor.userId === actor.userId &&
      item.actor.sessionId === actor.sessionId &&
      item.intent,
  );
  if (!source?.intent || !source.legId || leg(source).state !== 'exchanged')
    throw new Error('source exchange is required');
  const value = actorJson<{ id: string; version: number }>(
    actor,
    `with advanced as (update kaq_private.account_intents set state='awaiting_target',revision=revision+1 where id=${literal(source.intent.id)}::uuid and state='awaiting_source' and exists(select 1 from kaq_private.account_proof_legs where id=${literal(source.legId)}::uuid and state='exchanged') returning id,revision) select json_build_object('id',id,'version',revision)::text from advanced;`,
  );
  if (value.id !== source.intent.id || !Number.isSafeInteger(value.version))
    throw new Error('target fixture state advance failed');
  return { id: source.intent.id, secret: source.intent.secret, version: value.version };
}
