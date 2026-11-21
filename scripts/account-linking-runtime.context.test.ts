import { expect, test } from 'bun:test';
import {
  EncryptedPkceStorage,
  RuntimeStorageError,
} from '../supabase/functions/account-linking/runtime/pkce-storage.ts';
import type { RuntimeContext } from '../supabase/functions/account-linking/runtime/types.ts';
import {
  MemoryRepository,
  context,
  keyring,
  now,
  storage,
  storageKey,
} from './account-linking-runtime-fixture.ts';

test('rejects noncanonical context and preserves a cloned valid context', async () => {
  expect(
    () =>
      new EncryptedPkceStorage({
        repository: new MemoryRepository(),
        keyring: keyring(),
        crypto: globalThis.crypto,
        clock: { now: () => Number.NaN },
        context: {
          purpose: 'not-a-purpose' as 'leg',
          intentId: 'not-a-uuid',
          legId: 'also-not-a-uuid',
          attempt: 4,
          storageKey: 'arbitrary-client-key',
          issuedAt: Number.NaN,
          expiresAt: Number.NaN,
        },
      }),
  ).toThrow(RuntimeStorageError);
  const source = context();
  const instance = storage(new MemoryRepository(), { now: () => source.issuedAt, context: source });
  source.storageKey = 'mutated';
  await expect(instance.setItem(storageKey, '{"access_token":"a"}')).resolves.toBeUndefined();
});

test('checks every context boundary, lifetime purpose, and an invalid clock', async () => {
  const source = context();
  const make = (candidate: RuntimeContext = source, instant = now) =>
    storage(new MemoryRepository(), { now: () => instant, context: candidate });
  for (const candidate of [
    { ...source, purpose: 'invalid' as 'leg' },
    { ...source, attempt: 0 },
    { ...source, attempt: 4 },
    { ...source, intentId: 'bad' },
    { ...source, legId: 'bad' },
    { ...source, storageKey: 'bad' },
    { ...source, issuedAt: Number.NaN },
    { ...source, expiresAt: Number.NaN },
    { ...source, expiresAt: now + 180_001 },
  ])
    expect(() => make(candidate)).toThrow(RuntimeStorageError);
  expect(() => make({ ...source, purpose: 'proof', expiresAt: now + 600_000 })).not.toThrow();
  await expect(make(source, Number.NaN).getItem(storageKey)).rejects.toThrow(RuntimeStorageError);
});
