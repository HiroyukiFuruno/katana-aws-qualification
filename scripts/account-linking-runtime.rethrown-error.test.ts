import { expect, test } from 'bun:test';
import { decryptSlots, encryptSlots } from '../supabase/functions/account-linking/runtime/crypto.ts';
import { RuntimeStorageError } from '../supabase/functions/account-linking/runtime/types.ts';
import { context, MemoryRepository, storage, storageKey } from './account-linking-runtime-fixture.ts';

test('does not trust mutated failures previously returned by the same runtime', async () => {
  const original: unknown = await storage(new MemoryRepository())
    .getItem('unregistered-key')
    .catch((reason) => reason);
  if (!(original instanceof RuntimeStorageError)) throw new Error('expected original runtime error');
  original.message = 'reused-secret';
  Object.defineProperty(original, 'code', { value: 'expired' });
  const read = new MemoryRepository();
  read.failure = original;
  const external = [
    () => storage(read).getItem(storageKey),
    () =>
      storage(new MemoryRepository(), {
        now: () => {
          throw original;
        },
      }).getItem(storageKey),
  ];
  for (const operation of external) {
    const error: unknown = await operation().catch((reason) => reason);
    expect(error).toMatchObject({
      code: 'repository_failed',
      message: 'account-linking runtime storage: repository_failed',
    });
    expect(error).not.toBe(original);
  }
  const material = new Uint8Array(32);
  const record = await encryptSlots(globalThis.crypto, context(), 0, 'v1', material, {});
  Object.defineProperty(record, 'revision', {
    get: () => {
      throw original;
    },
  });
  const error: unknown = await decryptSlots(globalThis.crypto, context(), record, material).catch(
    (reason) => reason,
  );
  if (!(error instanceof RuntimeStorageError)) throw new Error('expected redacted runtime error');
  expect(error.message).not.toContain('reused-secret');
  expect(error.code).not.toBe('expired');
  expect(error).not.toBe(original);
});
