import assert from 'node:assert/strict';
import { expect, test } from '@playwright/test';
import { sql } from './commands';
import { ProofConnection } from './proof-connection';
import { type GrantFixture, grantHash, grantRpc, quote } from './session-grants-fixture';

export function normalGrantLock(getFixture: () => GrantFixture) {
  test('normal replay rechecks not_after after an actual grant-row lock wait', async () => {
    const actor = getFixture().actors[0];
    assert(actor);
    const sid = quote(actor.sessionId);
    const before = grantHash();
    let holder: ProofConnection | undefined;
    let pending: Promise<Awaited<ReturnType<typeof grantRpc>>> | undefined;
    const notAfter = sql(
      `select coalesce(to_jsonb(not_after),'null'::jsonb)::text from auth.sessions where id=${sid}`,
    );
    try {
      expect(
        (await grantRpc(actor, 'issue_learning_session_grant', { p_reason: 'reauthenticated' })).ok,
      ).toBe(true);
      const waitingHash = grantHash();
      sql(`update auth.sessions set not_after=clock_timestamp()+interval '2 seconds' where id=${sid}`);
      holder = await new ProofConnection().open();
      holder.send(
        `select 1 from kaq_private.learning_session_grants where session_id=${sid} for update; select 'grant_locked';`,
      );
      await holder.wait('grant_locked');
      pending = grantRpc(actor, 'issue_learning_session_grant', { p_reason: 'reauthenticated' });
      await holder.blocked();
      await expect
        .poll(() => sql(`select clock_timestamp() >= not_after from auth.sessions where id=${sid}`))
        .toBe('t');
      await holder.finish();
      holder = undefined;
      const result = await pending;
      pending = undefined;
      expect(result.ok).toBe(false);
      expect([401, 403]).toContain(result.status);
      expect(grantHash()).toBe(waitingHash);
    } finally {
      await holder?.abort();
      await pending?.catch(() => undefined);
      sql(`update auth.sessions set not_after=(${quote(notAfter)}::jsonb #>> '{}')::timestamptz where id=${sid};
        delete from kaq_private.learning_session_grants where session_id=${sid}`);
      expect(grantHash()).toBe(before);
    }
  });
}
