import { expect, test } from 'bun:test';
import type { RuntimeKeyring } from '../supabase/functions/account-linking/runtime/pkce-storage.ts';
import {
  MemoryRepository,
  context,
  now,
  storage,
  storageKey,
} from './account-linking-runtime-fixture.ts';

test('writes with an active key and reads a retained old key', async () => {
  const repository = new MemoryRepository();
  let version = 'v1';
  const keys: RuntimeKeyring = {
    active: async () => ({ version, bytes: new Uint8Array(32).fill(version === 'v1' ? 1 : 2) }),
    resolve: async (candidate) =>
      candidate === 'v1'
        ? new Uint8Array(32).fill(1)
        : candidate === 'v2'
          ? new Uint8Array(32).fill(2)
          : null,
  };
  const options = { now: () => now, keyring: keys, context: context() };
  await storage(repository, options).setItem(storageKey, JSON.stringify({ access_token: 'access' }));
  version = 'v2';
  expect(await storage(repository, options).getItem(storageKey)).toContain('access');
});
