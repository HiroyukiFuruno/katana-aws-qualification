import assert from 'node:assert/strict';
import { json, literal, requiredUuid, sql } from '../account-sdk/sql';
import { identifiers, type ProofRacePort } from './proof-race-state';

export type AdditionalProofRejection =
  | 'creationFreshness'
  | 'oauthFreshness'
  | 'sourceSession'
  | 'sourceFreshness'
  | 'disabledMember';

function change(table: string, column: string, where: string, next: string) {
  const before = json<{ value: string | null }>(
    `select json_build_object('value',${column}::text) from ${table} where ${where}`,
  );
  assert(before && Object.hasOwn(before, 'value'), 'Missing proof mutation fixture row');
  return {
    mutation: () => sql(`update ${table} set ${column}=${next} where ${where}`),
    restore: () =>
      sql(`update ${table} set ${column}=${before.value === null ? 'null' : literal(before.value)}
        where ${where}`),
  };
}

export function additionalRejection(port: ProofRacePort, kind: AdditionalProofRejection) {
  const { intent, leg, session } = identifiers(port);
  if (kind === 'creationFreshness')
    return change(
      'kaq_private.account_proof_legs',
      'issued_at',
      `id=${leg}`,
      `(select created_at+interval '1 microsecond' from auth.sessions where id=${session})`,
    );
  if (kind === 'oauthFreshness')
    return change(
      'auth.mfa_amr_claims',
      'updated_at',
      `session_id=${session} and authentication_method='oauth'`,
      `(select issued_at-interval '1 microsecond' from kaq_private.account_proof_legs where id=${leg})`,
    );
  assert.equal(port.side, 'target', 'Stored source/target membership cases require target flow');
  if (kind === 'disabledMember') {
    return change(
      'kaq_private.learning_memberships',
      'status',
      `auth_user_id=(select user_id from auth.sessions where id=${session})`,
      "'disabled'",
    );
  }
  const source = json<{ session: string; leg: string }>(`select json_build_object(
    'session',proof.session_id,'leg',proof.leg_id) from kaq_private.account_proofs proof
    join kaq_private.account_proof_legs leg on leg.id=proof.leg_id
    where proof.intent_id=${intent} and leg.side='source'`);
  const sourceSession = `${literal(requiredUuid(source.session))}::uuid`;
  if (kind === 'sourceSession')
    return change(
      'auth.sessions',
      'not_after',
      `id=${sourceSession}`,
      "clock_timestamp()-interval '1 minute'",
    );
  return change(
    'kaq_private.account_proof_legs',
    'issued_at',
    `id=${literal(requiredUuid(source.leg))}::uuid`,
    `(select created_at+interval '1 microsecond' from auth.sessions where id=${sourceSession})`,
  );
}
