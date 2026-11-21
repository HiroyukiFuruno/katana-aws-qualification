import assert from 'node:assert/strict';
import { EncryptedPkceStorage } from '../../../supabase/functions/account-linking/runtime/pkce-storage.ts';
import type { RuntimeContext } from '../../../supabase/functions/account-linking/runtime/types.ts';
import { CleanupSqlRepository, sql } from './runtime-cleanup-sql-adapter.ts';

type Fixture = RuntimeContext & { intentExpiresAt: number };
type KeyState = { active: number; resolve: number; blocked: boolean };

function environment(): { container: string; fixtures: Fixture[] } {
  const container = process.env.CLEANUP_CONTAINER;
  const value = process.env.CLEANUP_FIXTURES;
  if (!container || !value) throw new Error('missing cleanup fixture');
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed)) throw new Error('invalid cleanup fixture');
  return { container, fixtures: parsed as Fixture[] };
}

function storage(
  container: string,
  context: RuntimeContext,
): { value: EncryptedPkceStorage; repository: CleanupSqlRepository; keys: KeyState } {
  const repository = new CleanupSqlRepository(container, context);
  const keys: KeyState = { active: 0, resolve: 0, blocked: false };
  return {
    repository,
    value: new EncryptedPkceStorage({
      repository,
      crypto: globalThis.crypto,
      clock: { now: () => Date.now() },
      context,
      keyring: {
        active: async () => {
          keys.active += 1;
          if (keys.blocked) throw new Error('key access after save');
          return { version: 'v1', bytes: new Uint8Array(32).fill(7) };
        },
        resolve: async () => {
          keys.resolve += 1;
          if (keys.blocked) throw new Error('key access after save');
          return new Uint8Array(32).fill(7);
        },
      },
    }),
    keys,
  };
}

function guard(context: RuntimeContext): string {
  return JSON.stringify(context);
}

function statement(container: string, text: string): string {
  return sql(container, text);
}

async function terminalCleanup(
  container: string,
  context: Fixture,
  terminal: 'cancel' | 'expire',
): Promise<boolean> {
  const current = storage(container, context);
  await current.value.setItem(
    context.storageKey,
    '{"access_token":"secret","refresh_token":"refresh","code_verifier":"verifier"}',
  );
  const keyCalls = { active: current.keys.active, resolve: current.keys.resolve };
  current.keys.blocked = true;
  if (terminal === 'cancel') {
    statement(
      container,
      `update kaq_private.account_intents set state='cancelled' where id='${context.intentId}'::uuid;`,
    );
  } else {
    while (
      statement(
        container,
        `select kaq_private.runtime_epoch_ms(clock_timestamp()) >= ${context.expiresAt};`,
      ) !== 't'
    ) {}
  }
  assert.equal(await current.repository.read(context.legId), null);
  assert.equal(
    statement(
      container,
      `select kaq_private.runtime_delete_if_revision('${context.legId}'::uuid,null,'${guard(context).replaceAll("'", "''")}');`,
    ),
    'conflict',
  );
  await current.value.terminate();
  assert.equal(
    statement(
      container,
      `select count(*) from kaq_private.account_proof_runtime where leg_id='${context.legId}'::uuid;`,
    ),
    '0',
  );
  assert.deepEqual(current.keys, { ...keyCalls, blocked: true });
  return true;
}

async function fences(
  container: string,
  context: Fixture,
): Promise<{ staleRevision: true; oldContext: true }> {
  const current = storage(container, context);
  await current.value.setItem(context.storageKey, '{"access_token":"secret"}');
  const revision = statement(
    container,
    `select kaq_private.runtime_cleanup_revision('${context.legId}'::uuid,'${guard(context).replaceAll("'", "''")}');`,
  );
  statement(
    container,
    `update kaq_private.account_proof_runtime set revision=revision+1 where leg_id='${context.legId}'::uuid;`,
  );
  assert.equal(
    statement(
      container,
      `select kaq_private.runtime_delete_if_revision('${context.legId}'::uuid,${revision},'${guard(context).replaceAll("'", "''")}');`,
    ),
    'conflict',
  );
  statement(
    container,
    `update kaq_private.account_proof_legs set state='exchanged' where id='${context.legId}'::uuid; update kaq_private.account_proof_runtime set phase='proof',expires_at=to_timestamp(${context.intentExpiresAt}/1000.0) where leg_id='${context.legId}'::uuid;`,
  );
  await assert.rejects(current.value.terminate(), /cas_conflict/);
  assert.equal(
    statement(
      container,
      `select count(*) from kaq_private.account_proof_runtime where leg_id='${context.legId}'::uuid;`,
    ),
    '1',
  );
  return { staleRevision: true, oldContext: true };
}

const { container, fixtures } = environment();
const assertions = {
  cancel: await terminalCleanup(container, fixtures[0], 'cancel'),
  expire: await terminalCleanup(container, fixtures[1], 'expire'),
  ...(await fences(container, fixtures[2])),
};
console.log(JSON.stringify({ status: 'passed', assertions }));
