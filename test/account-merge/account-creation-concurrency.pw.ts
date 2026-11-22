import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import {
  createRpc,
  creationSnapshot,
  openCreationActor,
  quote,
  withCreationActor,
} from './account-creation-fixture';
import { sql } from './commands';

const rejected = (result: Awaited<ReturnType<typeof createRpc>>) => {
  expect(result.ok).toBe(false);
  expect([400, 401, 403, 409]).toContain(result.status);
};

test.describe('private createNew first-write concurrency', () => {
  test.describe.configure({ mode: 'serial' });

  test('two first-create requests with one OAuth SID converge to exactly one complete scope', async ({
    browser,
  }) => {
    await withCreationActor(browser, async (actor) => {
      const key = randomUUID();
      const [left, right] = await Promise.all([
        createRpc(actor, true, key),
        createRpc(actor, true, key),
      ]);
      expect(left.ok).toBe(true);
      expect(right).toEqual(left);
      const uid = quote(actor.userId);
      const sid = quote(actor.sessionId);
      for (const query of [
        `select count(*) from kaq_private.learning_accounts where id=${uid}`,
        `select count(*) from kaq_private.learning_memberships where auth_user_id=${uid}`,
        `select count(*) from public.learning_state where user_id=${uid}`,
        `select count(*) from kaq_private.learning_session_grants where session_id=${sid}`,
        `select count(*) from kaq_private.learning_account_creation_receipts where auth_user_id=${uid}`,
      ])
        expect(sql(query)).toBe('1');
    });
  });

  test('different request key and a new real OAuth SID cannot replay a creation receipt', async ({
    browser,
  }) => {
    await withCreationActor(browser, async (actor) => {
      const first = await createRpc(actor);
      expect(first.ok).toBe(true);
      const created = creationSnapshot();
      rejected(await createRpc(actor, true, randomUUID()));
      expect(creationSnapshot()).toEqual(created);
      let renewed: Awaited<ReturnType<typeof openCreationActor>> | undefined;
      try {
        renewed = await openCreationActor(browser);
        expect(renewed.userId).toBe(actor.userId);
        expect(renewed.sessionId).not.toBe(actor.sessionId);
        const reauthenticated = creationSnapshot();
        rejected(await createRpc(renewed, true, first.requestKey));
        expect(creationSnapshot()).toEqual(reauthenticated);
      } finally {
        await renewed?.close();
      }
    });
  });
});
