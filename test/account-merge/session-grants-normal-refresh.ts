import assert from 'node:assert/strict';
import { expect, test } from '@playwright/test';
import { sql } from './commands';
import { type GrantFixture, grantHash, grantRpc, quote } from './session-grants-fixture';

function iat(token: string) {
  const claims: unknown = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString());
  if (
    !claims ||
    typeof claims !== 'object' ||
    typeof (claims as Record<string, unknown>).iat !== 'number'
  )
    throw new Error('refresh token has no numeric iat');
  return (claims as Record<string, number>).iat;
}

export function normalGrantRefresh(getFixture: () => GrantFixture) {
  test('N-REFRESH-01 refreshed JWT cannot cross the old SID OAuth fence', async () => {
    const actor = getFixture().actors[0];
    assert(actor);
    const uid = quote(actor.userId);
    const sid = quote(actor.sessionId);
    const before = grantHash();
    const oldIat = iat(actor.accessToken);
    const authBefore =
      sql(`select jsonb_build_object('created',(select created_at from auth.sessions where id=${sid}),
      'oauth',(select updated_at from auth.mfa_amr_claims where session_id=${sid} and authentication_method='oauth'))::text`);
    const fenceBefore = sql(
      `select coalesce(to_jsonb(session_fence_at),'null'::jsonb)::text from kaq_private.learning_accounts where id=${uid}`,
    );
    try {
      sql(`update kaq_private.learning_accounts set session_fence_at=clock_timestamp() where id=${uid}`);
      const fence = sql(`select ceil(extract(epoch from session_fence_at))::bigint
        from kaq_private.learning_accounts where id=${uid}`);
      await expect
        .poll(() => sql(`select extract(epoch from clock_timestamp()) > ${fence} + 1`))
        .toBe('t');
      const refreshed = await actor.refresh();
      expect(iat(refreshed)).toBeGreaterThan(oldIat);
      const claims: unknown = JSON.parse(Buffer.from(refreshed.split('.')[1], 'base64url').toString());
      expect((claims as Record<string, unknown>).session_id).toBe(actor.sessionId);
      expect(
        sql(`select jsonb_build_object('created',(select created_at from auth.sessions where id=${sid}),
        'oauth',(select updated_at from auth.mfa_amr_claims where session_id=${sid} and authentication_method='oauth'))::text`),
      ).toBe(authBefore);
      const result = await grantRpc(
        { ...actor, accessToken: refreshed },
        'issue_learning_session_grant',
        { p_reason: 'reauthenticated' },
      );
      expect(result.ok).toBe(false);
      expect(grantHash()).toBe(before);
    } finally {
      sql(`update kaq_private.learning_accounts set session_fence_at=(${quote(fenceBefore)}::jsonb #>> '{}')::timestamptz where id=${uid};
        delete from kaq_private.learning_session_grants where session_id=${sid}`);
      expect(grantHash()).toBe(before);
    }
  });
}
