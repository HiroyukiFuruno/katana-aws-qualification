import { expect, test } from 'bun:test';
import type { RuntimeKeyring } from '../supabase/functions/account-linking/runtime/pkce-storage.ts';
import { MemoryRepository, storage, storageKey } from './account-linking-runtime-fixture.ts';

function disguised(secret: string): Error {
  const error = new Error(secret);
  error.name = 'RuntimeStorageError';
  return error;
}

test('redacts spoofed RuntimeStorageError names from repository and keyring', async () => {
  const repository = new MemoryRepository();
  repository.failure = disguised('repository-secret');
  const first = await storage(repository)
    .getItem(storageKey)
    .catch((reason) => reason);
  if (!(first instanceof Error)) throw new Error('expected runtime error');
  expect(first.message).not.toContain('repository-secret');
  const keys: RuntimeKeyring = {
    active: async () => {
      throw disguised('key-secret');
    },
    resolve: async () => {
      throw disguised('key-secret');
    },
  };
  const error = await storage(new MemoryRepository(), { keyring: keys })
    .setItem(storageKey, '{"access_token":"a"}')
    .catch((reason) => reason);
  if (!(error instanceof Error)) throw new Error('expected runtime error');
  expect(error.message).not.toContain('key-secret');
});
