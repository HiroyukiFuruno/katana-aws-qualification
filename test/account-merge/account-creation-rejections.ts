import { randomUUID } from 'node:crypto';
import { expect } from '@playwright/test';
import { type CreationActor, createRpc, creationSnapshot, quote } from './account-creation-fixture';
import { sql } from './commands';

type CreationRejection = { name: string; run: (actor: CreationActor) => Promise<void> };

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

export const creationRejections: readonly CreationRejection[] = [
  { name: 'denied consent', run: async (actor) => rejected(await createRpc(actor, false)) },
  { name: 'missing consent', run: async (actor) => rejected(await createRpc(actor, null)) },
  { name: 'missing request key', run: async (actor) => rejected(await createRpc(actor, true, null)) },
  {
    name: 'zero request key',
    run: async (actor) => rejected(await createRpc(actor, true, '00000000-0000-0000-0000-000000000000')),
  },
  {
    name: 'banned OAuth subject',
    run: (actor) => {
      const uid = quote(actor.userId);
      return rejectWithoutCreation(
        actor,
        `update auth.users set banned_until=clock_timestamp()+interval '1 hour' where id=${uid}`,
        `update auth.users set banned_until=null where id=${uid}`,
      );
    },
  },
  {
    name: 'deleted OAuth subject',
    run: (actor) => {
      const uid = quote(actor.userId);
      return rejectWithoutCreation(
        actor,
        `update auth.users set deleted_at=clock_timestamp() where id=${uid}`,
        `update auth.users set deleted_at=null where id=${uid}`,
      );
    },
  },
  ...[
    [
      'missing OAuth AMR',
      'delete from auth.mfa_amr_claims where session_id=$SID',
      'insert into auth.mfa_amr_claims select * from jsonb_populate_record(null::auth.mfa_amr_claims,$AMR::jsonb)',
    ],
    [
      'future OAuth AMR',
      "update auth.mfa_amr_claims set updated_at=clock_timestamp()+interval '1 hour' where session_id=$SID",
      'update auth.mfa_amr_claims set updated_at=(jsonb_populate_record(null::auth.mfa_amr_claims,$AMR::jsonb)).updated_at where session_id=$SID',
    ],
    [
      'infinite OAuth AMR',
      "update auth.mfa_amr_claims set updated_at='infinity' where session_id=$SID",
      'update auth.mfa_amr_claims set updated_at=(jsonb_populate_record(null::auth.mfa_amr_claims,$AMR::jsonb)).updated_at where session_id=$SID',
    ],
  ].map(([name, mutation, restore]) => ({
    name,
    run: (actor: CreationActor) => {
      const sid = quote(actor.sessionId);
      const amr = sql(
        `select to_jsonb(a)::text from auth.mfa_amr_claims a where session_id=${sid} and authentication_method='oauth'`,
      );
      return rejectWithoutCreation(
        actor,
        mutation.replaceAll('$SID', sid),
        restore.replaceAll('$SID', sid).replaceAll('$AMR', quote(amr)),
      );
    },
  })),
  {
    name: 'third-party OAuth client attachment',
    run: (actor) => {
      const sid = quote(actor.sessionId);
      const client = quote(randomUUID());
      const originalClient = sql(
        `select coalesce(to_jsonb(oauth_client_id),'null'::jsonb)::text from auth.sessions where id=${sid}`,
      );
      return rejectWithoutCreation(
        actor,
        `insert into auth.oauth_clients(id,registration_type,client_type,redirect_uris,grant_types,token_endpoint_auth_method)
          values(${client},'manual','public','https://fixture.invalid/callback','authorization_code','none');
          update auth.sessions set oauth_client_id=${client} where id=${sid}`,
        `update auth.sessions set oauth_client_id=(${quote(originalClient)}::jsonb #>> '{}')::uuid where id=${sid};
          delete from auth.oauth_clients where id=${client}`,
      );
    },
  },
  {
    name: 'legacy public ownership',
    run: (actor) => {
      const uid = quote(actor.userId);
      return rejectWithoutCreation(
        actor,
        `insert into public.learning_state(user_id,generation) values(${uid},0)`,
        `delete from public.learning_state where user_id=${uid}`,
      );
    },
  },
];
