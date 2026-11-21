import { expect, test } from 'bun:test';
import {
  RuntimeStorageError,
  type RuntimeKeyring,
} from '../supabase/functions/account-linking/runtime/pkce-storage.ts';
import {
  MemoryRepository,
  context,
  now,
  storage,
  storageKey,
} from './account-linking-runtime-fixture.ts';

function injected(): RuntimeStorageError {
  const error = new RuntimeStorageError('repository_failed');
  error.message = 'adapter-secret';
  Object.defineProperty(error, 'code', { value: 'invalid_key' });
  return error;
}

function keyringThat(method: 'active' | 'resolve'): RuntimeKeyring {
  return {
    active: async () =>
      method === 'active' ? Promise.reject(injected()) : { version: 'v1', bytes: new Uint8Array(32) },
    resolve: async () => (method === 'resolve' ? Promise.reject(injected()) : new Uint8Array(32)),
  };
}

async function fixed(operation: () => Promise<unknown>): Promise<void> {
  const error = await operation().catch((reason) => reason);
  if (!(error instanceof RuntimeStorageError)) throw new Error('expected runtime error');
  expect(error.code).toBe('repository_failed');
  expect(error.message).not.toContain('adapter-secret');
}

class TerminalErrorRepository extends MemoryRepository {
  override async isTerminal(): Promise<boolean> {
    throw injected();
  }
}

class DeleteErrorRepository extends MemoryRepository {
  override async deleteIfRevision(): Promise<'conflict'> {
    throw injected();
  }
}

class CasErrorRepository extends MemoryRepository {
  override async compareAndSwap(): Promise<boolean> {
    throw injected();
  }
}

test('normalizes genuine injected RuntimeStorageErrors at every dependency boundary', async () => {
  const read = new MemoryRepository();
  read.failure = injected();
  await fixed(() => storage(read).getItem(storageKey));
  await fixed(() => storage(new TerminalErrorRepository()).getItem(storageKey));
  await fixed(() => storage(new DeleteErrorRepository()).terminate());
  await fixed(() => storage(new CasErrorRepository()).setItem(storageKey, '{"access_token":"a"}'));
  await fixed(() =>
    storage(new MemoryRepository(), { keyring: keyringThat('active') }).setItem(
      storageKey,
      '{"access_token":"a"}',
    ),
  );
  const resolve = new MemoryRepository();
  await storage(resolve).setItem(storageKey, '{"access_token":"a"}');
  await fixed(() => storage(resolve, { keyring: keyringThat('resolve') }).getItem(storageKey));
  await fixed(() =>
    storage(new MemoryRepository(), {
      now: () => {
        throw injected();
      },
    }).getItem(storageKey),
  );
});

test('retains local invalid-key, expired, and malformed-value codes', async () => {
  const invalid: RuntimeKeyring = {
    active: async () => ({ version: 'v1', bytes: new Uint8Array(31) }),
    resolve: async () => null,
  };
  await expect(
    storage(new MemoryRepository(), { keyring: invalid }).setItem(storageKey, '{"access_token":"a"}'),
  ).rejects.toMatchObject({ code: 'invalid_key' });
  await expect(
    storage(new MemoryRepository(), { now: () => now + 180_000 }).getItem(storageKey),
  ).rejects.toMatchObject({ code: 'expired' });
  await expect(storage(new MemoryRepository()).setItem(storageKey, '[]')).rejects.toMatchObject({
    code: 'malformed_value',
  });
  expect(context().storageKey).toBe(storageKey);
});
