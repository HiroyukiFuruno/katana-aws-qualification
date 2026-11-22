import assert from 'node:assert/strict';
import { expect, test } from '@playwright/test';
import { sql } from './commands';
import { type GrantFixture, grantHash, grantRpc, quote } from './session-grants-fixture';

export function normalGrantConcurrency(getFixture: () => GrantFixture) {
  test('same OAuth SID concurrent normal grants converge to one row', async () => {
    const actor = getFixture().actors[0];
    assert(actor);
    const before = grantHash();
    try {
      const [left, right] = await Promise.all([
        grantRpc(actor, 'issue_learning_session_grant', { p_reason: 'reauthenticated' }),
        grantRpc(actor, 'issue_learning_session_grant', { p_reason: 'reauthenticated' }),
      ]);
      expect(left.ok).toBe(true);
      expect(right.ok).toBe(true);
      expect(right.value).toEqual(left.value);
      expect(
        sql(
          `select count(*) from kaq_private.learning_session_grants where session_id=${quote(actor.sessionId)}`,
        ),
      ).toBe('1');
    } finally {
      sql(`delete from kaq_private.learning_session_grants where session_id=${quote(actor.sessionId)}`);
      expect(grantHash()).toBe(before);
    }
  });
}
