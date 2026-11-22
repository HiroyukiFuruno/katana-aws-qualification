import assert from 'node:assert/strict';
import { expect, test } from '@playwright/test';
import { sql } from './commands';
import { type GrantFixture, grantHash, grantRpc, quote } from './session-grants-fixture';
import { normalGrantConcurrency } from './session-grants-normal-concurrency';
import { normalGrantInvalid } from './session-grants-normal-invalid';
import { type Mutation, rejects, rejectsSnapshot } from './session-grants-normal-support';

export function normalGrantCases(getFixture: () => GrantFixture) {
  normalGrantConcurrency(getFixture);
  test('normal grant accepts one real OAuth SID, resolves it, and replay keeps one row', async () => {
    const actor = getFixture().actors[0];
    assert(actor);
    const before = grantHash();
    try {
      const first = await grantRpc(actor, 'issue_learning_session_grant', {
        p_reason: 'reauthenticated',
      });
      expect(first.ok).toBe(true);
      const replay = await grantRpc(actor, 'issue_learning_session_grant', {
        p_reason: 'reauthenticated',
      });
      expect(replay).toEqual(first);
      expect((await grantRpc(actor, 'resolve_current_learning_grant')).ok).toBe(true);
      expect(
        sql(
          `select count(*) from kaq_private.learning_session_grants where session_id=${quote(actor.sessionId)}`,
        ),
      ).toBe('1');
      expect(grantHash()).not.toBe(before);
    } finally {
      sql(`delete from kaq_private.learning_session_grants where session_id=${quote(actor.sessionId)}`);
      expect(grantHash()).toBe(before);
    }
  });

  test('normal grant rejects old/equal/non-finite fences and invalid OAuth AMR without writes', async () => {
    const actor = getFixture().actors[0];
    assert(actor);
    const uid = quote(actor.userId);
    const sid = quote(actor.sessionId);
    const created = `(select created_at from auth.sessions where id=${sid})`;
    for (const mutation of [
      {
        apply: `update kaq_private.learning_accounts set session_fence_at=${created} where id=${uid}`,
        restore: `update kaq_private.learning_accounts set session_fence_at=null where id=${uid}`,
      },
      {
        apply: `update kaq_private.learning_memberships set session_fence_at='-infinity' where auth_user_id=${uid}`,
        restore: `update kaq_private.learning_memberships set session_fence_at=null where auth_user_id=${uid}`,
      },
      {
        apply: `update kaq_private.learning_accounts set session_fence_at='infinity' where id=${uid}`,
        restore: `update kaq_private.learning_accounts set session_fence_at=null where id=${uid}`,
      },
      {
        apply: `update auth.sessions set not_after=clock_timestamp()-interval '1 second' where id=${sid}`,
        restore: `update auth.sessions set not_after=null where id=${sid}`,
      },
    ] satisfies Mutation[])
      await rejects(actor, mutation);
    await rejectsSnapshot(
      actor,
      `select to_jsonb(a)::text from auth.mfa_amr_claims a where session_id=${sid} and authentication_method='oauth'`,
      `delete from auth.mfa_amr_claims where session_id=${sid} and authentication_method='oauth'`,
      (value) =>
        `insert into auth.mfa_amr_claims select * from jsonb_populate_record(null::auth.mfa_amr_claims,${quote(value)}::jsonb)`,
    );
    await rejectsSnapshot(
      actor,
      `select to_jsonb(a)::text from auth.mfa_amr_claims a where session_id=${sid} and authentication_method='oauth'`,
      `update auth.mfa_amr_claims set updated_at=clock_timestamp()+interval '1 hour' where session_id=${sid} and authentication_method='oauth'`,
      (value) =>
        `update auth.mfa_amr_claims set updated_at=(jsonb_populate_record(null::auth.mfa_amr_claims,${quote(value)}::jsonb)).updated_at where session_id=${sid} and authentication_method='oauth'`,
    );
  });

  normalGrantInvalid(getFixture);
}
