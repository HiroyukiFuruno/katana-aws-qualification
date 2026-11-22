import { expect } from '@playwright/test';
import { sql } from './commands';
import { type GrantFixture, grantHash, grantRpc } from './session-grants-fixture';

export type Mutation = { apply: string; restore: string };

export async function rejects(actor: GrantFixture['actors'][number], mutation: Mutation) {
  const before = grantHash();
  try {
    sql(mutation.apply);
    const result = await grantRpc(actor, 'issue_learning_session_grant', {
      p_reason: 'reauthenticated',
    });
    expect(result.ok).toBe(false);
    expect([400, 401, 403, 409]).toContain(result.status);
    expect(grantHash()).toBe(before);
  } finally {
    sql(mutation.restore);
  }
}

export async function rejectsSnapshot(
  actor: GrantFixture['actors'][number],
  snapshot: string,
  apply: string,
  restore: (value: string) => string,
) {
  const original = sql(snapshot);
  await rejects(actor, { apply, restore: restore(original) });
}
