import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { json, literal, sql } from '../account-sdk/sql';
import { ProofConnection } from './proof-connection';
import {
  assertRejected,
  identifiers,
  intentState,
  type ProofRacePort,
  restoreIntent,
  snapshot,
} from './proof-race-state';
import { type AdditionalProofRejection, additionalRejection } from './proof-rejections';
import { artifacts } from './settings';

type SourceFreshness = { sessionId: string; proofOauthAt: string; amrUpdatedAt: string };

async function blockedRejection(
  port: ProofRacePort,
  mutation: () => void,
  restore: () => void,
  cancelled = false,
) {
  const before = snapshot();
  const { intent } = identifiers(port);
  const holder = await new ProofConnection().open();
  let attempt: Promise<{ ok: boolean; error?: unknown }> | undefined;
  try {
    holder.send(`select 1 from kaq_private.account_intents where id=${intent} for update;
      select 'intent_locked';`);
    await holder.wait('intent_locked');
    attempt = port.accept().then(
      () => ({ ok: true }),
      (error: unknown) => ({ ok: false, error }),
    );
    const graph = await holder.blocked();
    if (cancelled) {
      holder.send(`update kaq_private.account_intents set state='cancelled',revision=revision+1
        where id=${intent}; select 'cancelled';`);
      await holder.wait('cancelled');
    } else mutation();
    await holder.finish(cancelled);
    const rejection = assertRejected(await attempt);
    return { graph, rejection, unintendedWrites: 0 };
  } finally {
    await holder.abort();
    if (attempt) await attempt;
    restore();
    assert.equal(snapshot(), before, 'Proof rejection changed protected rows');
  }
}

export type ProofRaceCase = 'cancel' | 'session' | 'sourceMembership' | AdditionalProofRejection;

export async function verifyProofRaces(port: ProofRacePort, only?: ProofRaceCase) {
  const { intent, leg, session } = identifiers(port);
  const cases: Record<string, object> = {};
  const prior = intentState(intent);
  if (!only || only === 'cancel')
    cases.cancelAfterWait = await blockedRejection(
      port,
      () => {},
      () => restoreIntent(intent, prior),
      true,
    );
  const deadline = json<{ value: string | null }>(
    `select json_build_object('value',not_after::text) from auth.sessions where id=${session}`,
  );
  if (!only || only === 'session')
    cases.sessionInvalidatedAfterWait = await blockedRejection(
      port,
      () =>
        sql(`update auth.sessions set not_after=clock_timestamp()-interval '1 minute'
      where id=${session}`),
      () =>
        sql(`update auth.sessions set not_after=${deadline.value === null ? 'null' : `${literal(deadline.value)}::timestamptz`}
      where id=${session}`),
    );
  if (port.side === 'target' && (!only || only === 'sourceMembership')) {
    const account = json<{ id: string; revision: string }>(`select json_build_object(
      'id',account.id,'revision',account.membership_revision::text)
      from kaq_private.account_intents intent join kaq_private.learning_accounts account
      on account.id=intent.source_account_id where intent.id=${intent}`);
    assert(account.id && account.revision);
    cases.sourceMembershipRevisionAfterWait = await blockedRejection(
      port,
      () =>
        sql(`update kaq_private.learning_accounts set membership_revision=membership_revision+1
        where id=${literal(account.id)}::uuid`),
      () =>
        sql(`update kaq_private.learning_accounts set membership_revision=${literal(account.revision)}::bigint
        where id=${literal(account.id)}::uuid`),
    );
  }
  if (only === 'creationFreshness') {
    const createdAt = json<{ value: string }>(`select json_build_object('value',created_at::text)
      from auth.sessions where id=${session}`);
    assert(createdAt.value, 'Missing proof session creation timestamp');
    const result = await blockedRejection(
      port,
      () => {
        sql(`update auth.sessions set created_at=(select issued_at-interval '1 microsecond'
          from kaq_private.account_proof_legs where id=${leg}) where id=${session}`);
        assert.equal(
          sql(`select created_at < (select issued_at from kaq_private.account_proof_legs where id=${leg})
            from auth.sessions where id=${session}`),
          't',
        );
      },
      () =>
        sql(`update auth.sessions set created_at=${literal(createdAt.value)}::timestamptz
          where id=${session}`),
    );
    assert.equal(result.rejection.status, 401);
    assert.equal(result.rejection.code, 'PT401');
    cases.creationFreshness = {
      ...result,
      authSessionCreatedAtRestored: true,
    };
  } else if (only === 'sourceFreshness') {
    const source = json<SourceFreshness>(`select json_build_object(
      'sessionId',proof.session_id,'proofOauthAt',proof.oauth_at::text,'amrUpdatedAt',amr.updated_at::text)
      from kaq_private.account_proofs proof join kaq_private.account_proof_legs leg on leg.id=proof.leg_id
      join auth.mfa_amr_claims amr on amr.session_id=proof.session_id and amr.authentication_method='oauth'
      where proof.intent_id=${intent} and leg.side='source'`);
    assert(Object.values(source).every(Boolean), 'Missing source OAuth freshness');
    const result = await blockedRejection(
      port,
      () =>
        sql(`update auth.mfa_amr_claims set updated_at=${literal(source.proofOauthAt)}::timestamptz-interval '1 microsecond'
          where session_id=${literal(source.sessionId)}::uuid and authentication_method='oauth'`),
      () =>
        sql(`update auth.mfa_amr_claims set updated_at=${literal(source.amrUpdatedAt)}::timestamptz
          where session_id=${literal(source.sessionId)}::uuid and authentication_method='oauth'`),
    );
    assert.equal(result.rejection.status, 401);
    assert.equal(result.rejection.code, 'PT401');
    cases.sourceFreshness = { ...result, sourceAmrUpdatedAtRestored: true };
  } else if (only && !['cancel', 'session', 'sourceMembership'].includes(only)) {
    const recipe = additionalRejection(port, only as AdditionalProofRejection);
    cases[only] = await blockedRejection(port, recipe.mutation, recipe.restore);
  }
  assert(Object.keys(cases).length > 0, 'No applicable proof race was executed');
  writeFileSync(
    `${artifacts}/proof-${port.side}-${only ?? 'all'}-races.json`,
    `${JSON.stringify({ status: 'passed', cases, signedHttp: true, shortJwtIssued: false }, null, 2)}\n`,
  );
}
