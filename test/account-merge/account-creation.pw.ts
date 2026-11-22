import { expect, test } from '@playwright/test';
import { createRpc, quote, withCreationActor } from './account-creation-fixture';
import { creationRejections } from './account-creation-rejections';
import { sql } from './commands';
import { ProofConnection } from './proof-connection';

const rejected = (result: Awaited<ReturnType<typeof createRpc>>) => {
  expect(result.ok).toBe(false);
  expect([400, 401, 403, 409]).toContain(result.status);
};

test.describe('private createNew with real OAuth and PostgREST', () => {
  test.describe.configure({ mode: 'serial' });

  test('replays the same OAuth request with one scope and receipt UUID', async ({ browser }) => {
    await withCreationActor(browser, async (actor) => {
      const first = await createRpc(actor);
      expect(first.ok).toBe(true);
      const replay = await createRpc(actor, true, first.requestKey);
      expect(replay).toEqual(first);
      expect(first.value).toMatchObject({
        receipt_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        account_id: actor.userId,
        membership_epoch: 0,
        generation: 0,
      });
      sql(
        `update kaq_private.learning_accounts set session_fence_at=clock_timestamp() where id=${quote(actor.userId)}`,
      );
      rejected(await createRpc(actor, true, first.requestKey));
    });
  });

  for (const rejection of creationRejections) {
    test(`rejects ${rejection.name} before creation`, async ({ browser }) => {
      await withCreationActor(browser, (actor) => rejection.run(actor));
    });
  }

  test('serializes Auth UPDATE and concurrent same-SID requests to one receipt', async ({ browser }) => {
    await withCreationActor(browser, async (actor) => {
      let holder: ProofConnection | undefined;
      let pending: Promise<Awaited<ReturnType<typeof createRpc>>> | undefined;
      try {
        holder = await new ProofConnection().open();
        holder.send(
          `select 1 from auth.users where id=${quote(actor.userId)} for update; select 'auth_locked';`,
        );
        await holder.wait('auth_locked');
        pending = createRpc(actor);
        await holder.blocked();
        await holder.finish();
        holder = undefined;
        const locked = await pending;
        pending = undefined;
        expect(locked.ok).toBe(true);
        const [left, right] = await Promise.all([
          createRpc(actor, true, locked.requestKey),
          createRpc(actor, true, locked.requestKey),
        ]);
        expect(left).toEqual(locked);
        expect(right).toEqual(locked);
        expect(
          sql(
            `select count(*) from kaq_private.learning_account_creation_receipts where auth_user_id=${quote(actor.userId)}`,
          ),
        ).toBe('1');
      } finally {
        await holder?.abort();
        await pending?.catch(() => undefined);
      }
    });
  });
});
