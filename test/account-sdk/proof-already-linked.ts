import assert from 'node:assert/strict';
import { publicState } from '../account-merge/public-state';
import { type Actor, actorJson, literal, requiredUuid, sql } from './sql';

type Intent = { id: string; secret: string; version: number };
type Control = { state?: unknown; version?: unknown; commit_receipt_id?: unknown };
export type TerminalProofIdentity = {
  legId: string;
  side: 'source' | 'target';
  proofAuthUid: string;
  proofSessionId: string;
};

// same-owner membership is synthetic fixture input; this verifies terminal no-op only, not a writer path.
export function ownershipSnapshot(intentId: string) {
  const scope = sql(`select jsonb_build_object(
    'accounts',coalesce((select jsonb_agg(to_jsonb(account) order by account.id) from kaq_private.learning_accounts account
      join kaq_private.account_intents intent on intent.id=${literal(requiredUuid(intentId))}::uuid
        and account.id=intent.source_account_id), '[]'::jsonb),
    'memberships',coalesce((select jsonb_agg(to_jsonb(member) order by member.auth_user_id) from kaq_private.learning_memberships member
      join kaq_private.account_intents intent on intent.id=${literal(requiredUuid(intentId))}::uuid
        and member.account_id=intent.source_account_id), '[]'::jsonb),
    'state',coalesce((select jsonb_agg(to_jsonb(learner_state) order by learner_state.user_id) from public.learning_state learner_state
      join kaq_private.account_intents intent on intent.id=${literal(requiredUuid(intentId))}::uuid
        and learner_state.user_id=intent.source_account_id), '[]'::jsonb),
    'grants',coalesce((select jsonb_agg(to_jsonb(grant_row) order by grant_row.session_id) from kaq_private.learning_session_grants grant_row
      join kaq_private.account_intents intent on intent.id=${literal(requiredUuid(intentId))}::uuid
        and grant_row.account_id=intent.source_account_id), '[]'::jsonb))::text;`);
  return JSON.stringify({ scope, public: publicState() });
}

function control(actor: Actor, statement: string): Control {
  return actorJson<Control>(actor, statement);
}

function receiptId(value: Control) {
  assert.equal(value.state, 'already_linked');
  if (typeof value.commit_receipt_id !== 'string') throw new Error('terminal receipt is missing');
  return requiredUuid(value.commit_receipt_id);
}

export function assertAlreadyLinkedControl(actor: Actor, intent: Intent, kind: string) {
  const id = requiredUuid(intent.id);
  const status = control(
    actor,
    `select kaq_private.read_account_intent(${literal(id)}::uuid,${literal(intent.secret)})::text;`,
  );
  const receipt = receiptId(status);
  if (!Number.isSafeInteger(status.version)) throw new Error('terminal intent version is invalid');
  const cancel = control(
    actor,
    `select kaq_private.cancel_account_intent(${literal(id)}::uuid,${literal(intent.secret)},${status.version})::text;`,
  );
  assert.equal(receiptId(cancel), receipt);
  const key = sql(
    `select begin_idempotency_key::text from kaq_private.account_intents where id=${literal(id)}::uuid;`,
  );
  const replay = control(
    actor,
    `select kaq_private.begin_account_intent(${literal(kind)},${literal(requiredUuid(key))}::uuid,false)::text;`,
  );
  assert.equal(receiptId(replay), receipt);
  return receipt;
}

export function assertAlreadyLinkedResult(intentId: string, sameAuthUser: boolean, receiptId: string) {
  const value = JSON.parse(
    sql(`select json_build_object('state',intent.state,'receipt_id',receipt.id,'receipt_count',
      (select count(*) from kaq_private.account_merge_receipts where intent_id=intent.id),'target_empty',
      intent.target_uid is null and intent.target_account_id is null and intent.target_membership_epoch is null,
      'result',receipt.result)::text from kaq_private.account_intents intent
      join kaq_private.account_merge_receipts receipt on receipt.intent_id=intent.id
      where intent.id=${literal(requiredUuid(intentId))}::uuid;`),
  ) as Record<string, unknown>;
  assert.deepEqual(value, {
    state: 'already_linked',
    receipt_id: requiredUuid(receiptId),
    receipt_count: 1,
    target_empty: sameAuthUser,
    result: {
      operation: 'already_linked',
      consent_required: false,
      no_ownership_change: true,
      evidence_domain: 'kaq.account-merge.already-linked.evidence.v1',
      same_auth_user: sameAuthUser,
    },
  });
}

export function assertTerminalProofDatabase(intentId: string, proofs: TerminalProofIdentity[]) {
  if (proofs.length !== 2) throw new Error('terminal proof identities are incomplete');
  const predicates = proofs
    .map(
      (proof) =>
        `(p.leg_id=${literal(requiredUuid(proof.legId))}::uuid and p.auth_uid=${literal(requiredUuid(proof.proofAuthUid))}::uuid and p.session_id=${literal(requiredUuid(proof.proofSessionId))}::uuid)`,
    )
    .join(' or ');
  const count = sql(`select count(*) from kaq_private.account_proofs p
    join kaq_private.account_intents i on i.id=p.intent_id
    where p.intent_id=${literal(requiredUuid(intentId))}::uuid and i.state='already_linked' and (${predicates})
      and exists (select 1 from auth.sessions s where s.id=p.session_id and s.user_id=p.auth_uid
        and s.created_at is not null and exists (select 1 from auth.mfa_amr_claims amr
          where amr.session_id=s.id and amr.authentication_method='oauth' and amr.updated_at >= s.created_at));`);
  assert.equal(count, '2');
}
