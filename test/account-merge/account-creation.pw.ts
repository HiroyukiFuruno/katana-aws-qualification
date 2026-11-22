import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import {
  createRpc,
  creationSnapshot,
  quote,
  type CreationActor,
  withCreationActor,
} from './account-creation-fixture';
import { sql } from './commands';
import { ProofConnection } from './proof-connection';

const rejected = (result: Awaited<ReturnType<typeof createRpc>>) => {
  expect(result.ok).toBe(false);
  expect([400, 401, 403, 409]).toContain(result.status);
};

async function rejectWithoutCreation(actor: CreationActor, mutation: string, restore: string) {
  try {
    sql(mutation);
    const mutated = creationSnapshot();
    rejected(await createRpc(actor));
    expect(creationSnapshot()).toEqual(mutated);
  } finally {
    sql(restore);
  }
}

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

  test('rejects invalid live OAuth context and legacy public ownership before creation', async ({
    browser,
  }) => {
    await withCreationActor(browser, async (actor) => {
      const uid = quote(actor.userId);
      const sid = quote(actor.sessionId);
      rejected(await createRpc(actor, false));
      rejected(await createRpc(actor, null));
      rejected(await createRpc(actor, true, null));
      rejected(await createRpc(actor, true, '00000000-0000-0000-0000-000000000000'));
      await rejectWithoutCreation(
        actor,
        `update auth.users set banned_until=clock_timestamp()+interval '1 hour' where id=${uid}`,
        `update auth.users set banned_until=null where id=${uid}`,
      );
      await rejectWithoutCreation(
        actor,
        `update auth.users set deleted_at=clock_timestamp() where id=${uid}`,
        `update auth.users set deleted_at=null where id=${uid}`,
      );
      const amr = sql(
        `select to_jsonb(a)::text from auth.mfa_amr_claims a where session_id=${sid} and authentication_method='oauth'`,
      );
      await rejectWithoutCreation(
        actor,
        `delete from auth.mfa_amr_claims where session_id=${sid}`,
        `insert into auth.mfa_amr_claims select * from jsonb_populate_record(null::auth.mfa_amr_claims,${quote(amr)}::jsonb)`,
      );
      await rejectWithoutCreation(
        actor,
        `update auth.mfa_amr_claims set updated_at=clock_timestamp()+interval '1 hour' where session_id=${sid}`,
        `update auth.mfa_amr_claims set updated_at=(jsonb_populate_record(null::auth.mfa_amr_claims,${quote(amr)}::jsonb)).updated_at where session_id=${sid}`,
      );
      await rejectWithoutCreation(
        actor,
        `update auth.mfa_amr_claims set updated_at='infinity' where session_id=${sid}`,
        `update auth.mfa_amr_claims set updated_at=(jsonb_populate_record(null::auth.mfa_amr_claims,${quote(amr)}::jsonb)).updated_at where session_id=${sid}`,
      );
      const client = quote(randomUUID());
      const originalClient = sql(
        `select coalesce(to_jsonb(oauth_client_id),'null'::jsonb)::text from auth.sessions where id=${sid}`,
      );
      await rejectWithoutCreation(
        actor,
        `insert into auth.oauth_clients(id,registration_type,client_type,redirect_uris,grant_types,token_endpoint_auth_method)
          values(${client},'manual','public','https://fixture.invalid/callback','authorization_code','none');
          update auth.sessions set oauth_client_id=${client} where id=${sid}`,
        `update auth.sessions set oauth_client_id=(${quote(originalClient)}::jsonb #>> '{}')::uuid where id=${sid};
          delete from auth.oauth_clients where id=${client}`,
      );
      await rejectWithoutCreation(
        actor,
        `insert into public.learning_state(user_id,generation) values(${uid},0)`,
        `delete from public.learning_state where user_id=${uid}`,
      );
    });
  });

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
