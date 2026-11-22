import { randomUUID } from 'node:crypto';
import type { ServerSdkLeg } from '../../supabase/functions/account-linking/server/sdk-worker.types.ts';
import { type Actor, actorJson, literal, requiredUuid } from './sql';

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
  proved_auth_uid?: string;
  proved_session_id?: string;
};
type BeginReply = { id: string; secret: string; version: number };
export type Intent = { id: string; secret: string; version: number };
export type IntentKind = 'add_existing' | 'merge_existing';
export type SourceScope = { accountId: string; membershipEpoch: number; accountRevision: number };
export type Operation = {
  actor: Actor;
  side: 'source' | 'target';
  kind?: IntentKind;
  provider?: 'keycloak' | 'azure';
  sourceScope?: SourceScope;
  intent?: Intent;
  legId?: string;
  nonceHash?: Uint8Array;
  claimId?: string;
  intentVersion?: number;
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
    `select (kaq_private.authorization_control_result(intent,proof,false,false) || jsonb_strip_nulls(jsonb_build_object('proved_auth_uid',receipt.auth_uid,'proved_session_id',receipt.session_id)))::text from kaq_private.account_intents intent join kaq_private.account_proof_legs proof on proof.intent_id=intent.id left join kaq_private.account_proofs receipt on receipt.leg_id=proof.id where intent.id=${literal(operation.intent.id)}::uuid and proof.id=${literal(operation.legId)}::uuid;`,
  );
  if (value.leg_id !== operation.legId || value.intent_id !== operation.intent.id || !value.guard)
    throw new Error('SDK leg binding failed');
  if (!Number.isSafeInteger(value.intent_revision)) throw new Error('invalid intent revision');
  operation.intentVersion = value.intent_revision;
  if (
    (value.proved_auth_uid === undefined) !== (value.proved_session_id === undefined) ||
    (value.proved_auth_uid !== undefined &&
      value.proved_session_id !== undefined &&
      (!requiredUuid(value.proved_auth_uid) || !requiredUuid(value.proved_session_id)))
  )
    throw new Error('invalid proof identity');
  return {
    id: value.leg_id,
    state: value.leg_state,
    revision: value.leg_revision,
    intentState: value.intent_state,
    expiresAt: value.guard.expiresAt,
    provider: operation.provider ?? (operation.side === 'source' ? 'keycloak' : 'azure'),
    runtime: value.guard,
    nonceHash: operation.nonceHash,
    side: operation.side,
    active: ['awaiting_source', 'awaiting_target'].includes(value.intent_state),
    authorizationPrepared: value.authorization_prepared === true,
    ...(operation.side === 'source' ? { expectedAuthUid: operation.actor.userId } : {}),
    ...(value.proved_auth_uid && value.proved_session_id
      ? { provedAuthUid: value.proved_auth_uid, provedSessionId: value.proved_session_id }
      : {}),
  };
}
export function sourceIntent(
  actor: Actor,
  kind: IntentKind = 'add_existing',
  sourceScope?: SourceScope,
): Intent {
  const headers =
    kind === 'merge_existing'
      ? (() => {
          if (!sourceScope) throw new Error('missing merge-existing source scope');
          requiredUuid(sourceScope.accountId);
          if (
            !Number.isSafeInteger(sourceScope.membershipEpoch) ||
            !Number.isSafeInteger(sourceScope.accountRevision)
          )
            throw new Error('invalid merge-existing source scope');
          return `set local request.headers = ${literal(
            JSON.stringify({
              'x-kaq-account-id': sourceScope.accountId,
              'x-kaq-membership-epoch': String(sourceScope.membershipEpoch),
            }),
          )};`;
        })()
      : '';
  const value = actorJson<BeginReply>(
    actor,
    `${headers}
     select kaq_private.begin_account_intent(${literal(kind)},${literal(randomUUID())}::uuid,false)::text;`,
  );
  if (!value.id || !value.secret || !Number.isSafeInteger(value.version))
    throw new Error('SDK source intent failed');
  requiredUuid(value.id);
  if (kind === 'merge_existing') {
    if (!sourceScope) throw new Error('missing persisted merge-existing source scope');
    const persisted = actorJson<SourceScope>(
      actor,
      `select json_build_object('accountId',intent.source_account_id,'membershipEpoch',intent.source_membership_epoch,
        'accountRevision',account.membership_revision)::text from kaq_private.account_intents intent
        join kaq_private.learning_accounts account on account.id=intent.source_account_id
        where intent.id=${literal(value.id)}::uuid;`,
    );
    if (
      persisted.accountId !== sourceScope.accountId ||
      persisted.membershipEpoch !== sourceScope.membershipEpoch ||
      persisted.accountRevision !== sourceScope.accountRevision
    )
      throw new Error('merge-existing source scope was not persisted');
  }
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
  if (!source?.intent || !source.legId || leg(source).state !== 'proved')
    throw new Error('source exchange is required');
  const current = leg(source);
  if (current.intentState !== 'awaiting_target') throw new Error('source proof did not advance intent');
  const version = source.intentVersion;
  if (typeof version !== 'number' || !Number.isSafeInteger(version))
    throw new Error('missing source intent revision');
  return { id: source.intent.id, secret: source.intent.secret, version };
}
