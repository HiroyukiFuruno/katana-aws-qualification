import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { setImmediate } from 'node:timers/promises';
import { json, literal, requiredUuid, sql } from '../account-sdk/sql';
import { ProofConnection } from './proof-connection';
import { assertRejected, identifiers, type ProofRacePort, snapshot } from './proof-race-state';
import { type ProofRaceCase, verifyProofRaces } from './proof-races';
import { artifacts } from './settings';

export type TargetRace =
  | 'sourceMembership'
  | 'sourceDeadline'
  | 'targetMembership'
  | 'sourceSession'
  | 'sourceFreshness';
type TargetPort = ProofRacePort & { proofAuthUid: string };
type Scope = { accountId: string; epoch: string; revision: string; status: string };

function sourceScope(port: ProofRacePort): Scope {
  const { intent } = identifiers(port);
  return json<Scope>(`select json_build_object('accountId',account.id,'epoch',member.epoch::text,
    'revision',account.membership_revision::text,'status',member.status) from kaq_private.account_intents intent
    join kaq_private.learning_memberships member on member.auth_user_id=intent.actor_uid
    join kaq_private.learning_accounts account on account.id=member.account_id where intent.id=${intent}`);
}

function targetScope(port: TargetPort): Scope {
  return json<Scope>(`select json_build_object('accountId',account.id,'epoch',member.epoch::text,
    'revision',account.membership_revision::text,'status',member.status) from kaq_private.learning_memberships member
    join kaq_private.learning_accounts account on account.id=member.account_id
    where member.auth_user_id=${literal(requiredUuid(port.proofAuthUid))}::uuid`);
}

async function waitForDeadline(deadline: string) {
  while (sql(`select clock_timestamp() >= ${literal(deadline)}::timestamptz`) !== 't')
    await setImmediate();
}

async function rejectAfterStateWait(
  port: ProofRacePort,
  accountId: string,
  mutation: () => void,
  restore: () => void,
  expected: { status: number; code: string },
  beforeAttempt?: () => string | undefined,
) {
  const before = snapshot();
  const holder = await new ProofConnection().open();
  let attempt: Promise<{ ok: boolean; error?: unknown }> | undefined;
  try {
    holder.send(`select 1 from public.learning_state where user_id=${literal(requiredUuid(accountId))}::uuid
      for update; select 'state_locked';`);
    await holder.wait('state_locked');
    const deadline = beforeAttempt?.();
    attempt = port.accept().then(
      () => ({ ok: true }),
      (error: unknown) => ({ ok: false, error }),
    );
    const graph = await holder.blocked();
    if (deadline)
      assert.equal(
        sql(`select clock_timestamp() < ${literal(deadline)}::timestamptz`),
        't',
        'deadline expired before the real state wait was observed',
      );
    mutation();
    if (deadline) await waitForDeadline(deadline);
    await holder.finish();
    const rejection = assertRejected(await attempt);
    assert.deepEqual(rejection, expected);
    return { graph, rejection, stateWaitObserved: true };
  } finally {
    await holder.abort();
    if (attempt) await attempt;
    restore();
    assert.equal(snapshot(), before, 'Target proof rejection changed protected rows');
  }
}

export async function verifyTargetProofRace(port: TargetPort, kind: TargetRace) {
  if (kind === 'sourceSession' || kind === 'sourceFreshness') {
    await verifyProofRaces(port, kind satisfies ProofRaceCase);
    return;
  }
  const scope = kind === 'targetMembership' ? targetScope(port) : sourceScope(port);
  assert.equal(scope.status, 'active');
  let result: object;
  if (kind === 'sourceMembership') {
    result = await rejectAfterStateWait(
      port,
      scope.accountId,
      () =>
        sql(`update kaq_private.learning_memberships set epoch=epoch+1
          where account_id=${literal(scope.accountId)}::uuid;
          update kaq_private.learning_accounts set membership_revision=membership_revision+1
          where id=${literal(scope.accountId)}::uuid;`),
      () =>
        sql(`update kaq_private.learning_memberships set epoch=${literal(scope.epoch)}::bigint
          where account_id=${literal(scope.accountId)}::uuid;
          update kaq_private.learning_accounts set membership_revision=${literal(scope.revision)}::bigint
          where id=${literal(scope.accountId)}::uuid;`),
      { status: 409, code: 'PT409' },
    );
  } else if (kind === 'targetMembership') {
    result = await rejectAfterStateWait(
      port,
      scope.accountId,
      () =>
        sql(`update kaq_private.learning_memberships set status='disabled'
          where auth_user_id=${literal(requiredUuid(port.proofAuthUid))}::uuid;
          update kaq_private.learning_accounts set membership_revision=membership_revision+1
          where id=${literal(scope.accountId)}::uuid;`),
      () =>
        sql(`update kaq_private.learning_memberships set status=${literal(scope.status)}
          where auth_user_id=${literal(requiredUuid(port.proofAuthUid))}::uuid;
          update kaq_private.learning_accounts set membership_revision=${literal(scope.revision)}::bigint
          where id=${literal(scope.accountId)}::uuid;`),
      { status: 409, code: 'PT409' },
    );
  } else {
    const { intent } = identifiers(port);
    const sourceSession = json<{ sessionId: string; notAfter: string | null }>(`select json_build_object(
      'sessionId',proof.session_id,'notAfter',session.not_after::text) from kaq_private.account_proofs proof
      join kaq_private.account_proof_legs leg on leg.id=proof.leg_id
      join auth.sessions session on session.id=proof.session_id
      where proof.intent_id=${intent} and leg.side='source'`);
    requiredUuid(sourceSession.sessionId);
    result = await rejectAfterStateWait(
      port,
      scope.accountId,
      () => {},
      () =>
        sql(`update auth.sessions set not_after=${sourceSession.notAfter === null ? 'null' : `${literal(sourceSession.notAfter)}::timestamptz`}
          where id=${literal(sourceSession.sessionId)}::uuid`),
      { status: 403, code: '28000' },
      () =>
        sql(`update auth.sessions
          set not_after=clock_timestamp()+interval '500 milliseconds'
          where id=${literal(sourceSession.sessionId)}::uuid
          returning not_after::text`),
    );
  }
  writeFileSync(
    `${artifacts}/proof-target-${kind}-race.json`,
    `${JSON.stringify({ status: 'passed', kind, result, signedHttp: true, shortJwtIssued: false }, null, 2)}\n`,
  );
}
