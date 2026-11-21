import { expect, test } from 'bun:test';
import { RuntimeStorageError } from '../supabase/functions/account-linking/runtime/pkce-storage.ts';
import { MemoryRepository, storage, storageKey } from './account-linking-runtime-fixture.ts';

test('termination follows an in-flight write, removes ciphertext, and keeps its queue usable', async () => {
  const repository = new MemoryRepository();
  const compared = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  repository.onCompare = async () => {
    compared.resolve();
    await release.promise;
  };
  const current = storage(repository);
  const writing = current.setItem(storageKey, '{"access_token":"a"}');
  await compared.promise;
  const terminating = current.terminate();
  release.resolve();
  const settled = await Promise.allSettled([writing, terminating]);
  expect(settled.map((result) => result.status)).toEqual(['fulfilled', 'fulfilled']);
  expect(repository.record).toBeNull();
  expect(await storage(repository).getItem(storageKey)).toBeNull();
  await expect(current.setItem(storageKey, '{"access_token":"a"}')).rejects.toThrow(RuntimeStorageError);
  const failed = new MemoryRepository();
  let calls = 0;
  failed.onCompare = async () => {
    if (++calls === 1) throw new Error('adapter failed');
  };
  const retried = storage(failed);
  await expect(retried.setItem(storageKey, '{"access_token":"a"}')).rejects.toThrow(RuntimeStorageError);
  await expect(retried.setItem(storageKey, '{"access_token":"a"}')).resolves.toBeUndefined();
  expect(calls).toBe(2);
  expect(failed.record).not.toBeNull();
});
