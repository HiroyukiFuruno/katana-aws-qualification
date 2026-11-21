import { expect, test } from 'bun:test';
import {
  RuntimeStorageError,
  type RuntimeKeyring,
} from '../supabase/functions/account-linking/runtime/pkce-storage.ts';
import { MemoryRepository, now, storage, storageKey } from './account-linking-runtime-fixture.ts';

const started = () => Promise.withResolvers<void>();

test('rejects expiry during awaited key access and terminal state during CAS', async () => {
  let instant = now;
  const keyStarted = started();
  const keyRelease = started();
  const waitingKeys: RuntimeKeyring = {
    active: async () => {
      keyStarted.resolve();
      await keyRelease.promise;
      return { version: 'v1', bytes: new Uint8Array(32) };
    },
    resolve: async () => new Uint8Array(32),
  };
  const writing = storage(new MemoryRepository(), { now: () => instant, keyring: waitingKeys }).setItem(
    storageKey,
    '{"access_token":"a"}',
  );
  await keyStarted.promise;
  instant = now + 180_000;
  keyRelease.resolve();
  await expect(writing).rejects.toThrow(RuntimeStorageError);
  const repository = new MemoryRepository();
  const casStarted = started();
  const casRelease = started();
  repository.onCompare = async () => {
    casStarted.resolve();
    await casRelease.promise;
  };
  const pending = storage(repository).setItem(storageKey, '{"access_token":"a"}');
  await casStarted.promise;
  repository.terminal = true;
  casRelease.resolve();
  await expect(pending).rejects.toThrow(RuntimeStorageError);
  const stored = new MemoryRepository();
  await storage(stored).setItem(storageKey, '{"access_token":"a"}');
  const resolveStarted = started();
  const resolveRelease = started();
  const delayedResolve: RuntimeKeyring = {
    active: async () => ({ version: 'v1', bytes: new Uint8Array(32) }),
    resolve: async () => {
      resolveStarted.resolve();
      await resolveRelease.promise;
      return new Uint8Array(32);
    },
  };
  const reading = storage(stored, { keyring: delayedResolve }).getItem(storageKey);
  await resolveStarted.promise;
  stored.terminal = true;
  resolveRelease.resolve();
  await expect(reading).rejects.toThrow(RuntimeStorageError);
});

test('deletes an expired or terminal blob and redacts repository failures', async () => {
  let instant = now;
  const repository = new MemoryRepository();
  const current = storage(repository, { now: () => instant });
  await current.setItem(storageKey, '{"access_token":"a"}');
  instant = now + 180_000;
  repository.terminal = true;
  await expect(current.terminate()).resolves.toBeUndefined();
  expect(repository.record).toBeNull();
  const failed = new MemoryRepository();
  failed.failure = new Error('provider-secret');
  const error = await storage(failed)
    .getItem(storageKey)
    .catch((reason) => reason);
  if (!(error instanceof Error)) throw new Error('expected runtime error');
  expect(error.message).not.toContain('provider-secret');
});
