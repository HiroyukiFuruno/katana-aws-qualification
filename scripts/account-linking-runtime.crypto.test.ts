import { expect, test } from 'bun:test';
import { RuntimeStorageError } from '../supabase/functions/account-linking/runtime/pkce-storage.ts';
import {
  MemoryRepository,
  context,
  keyring,
  now,
  storage,
  storageKey,
} from './account-linking-runtime-fixture.ts';

function fixture(overrides: Partial<{ expiresAt: number; attempt: number }> = {}) {
  const repository = new MemoryRepository();
  return {
    repository,
    storage: storage(repository, { keyring: keyring('current', 7), context: context(overrides) }),
  };
}

test('encrypts SDK storage, strips provider credentials, and preserves Auth tokens', async () => {
  const { repository, storage: client } = fixture();
  await client.setItem(
    storageKey,
    JSON.stringify({
      access_token: 'access',
      refresh_token: 'refresh',
      provider_token: 'provider-secret',
      provider_refresh_token: 'provider-refresh',
    }),
  );
  expect(await client.getItem(storageKey)).toBe(
    JSON.stringify({ access_token: 'access', refresh_token: 'refresh' }),
  );
  const record = repository.record;
  if (!record) throw new Error('expected encrypted record');
  expect(new TextDecoder().decode(record.ciphertext)).not.toContain('provider-secret');
  expect(record.nonce).toHaveLength(12);
  const nonce = record.nonce.slice();
  await client.setItem(`${storageKey}-code-verifier`, '"verifier"');
  expect(repository.record?.nonce).not.toEqual(nonce);
  const error = await client.setItem(storageKey, 'provider-secret').catch((reason) => reason);
  if (!(error instanceof Error)) throw new Error('expected storage error');
  expect(error.message).not.toContain('provider-secret');
});

test('fails closed for tampering, changed AAD, expiry, and unavailable keys', async () => {
  const { repository, storage: client } = fixture();
  await client.setItem(storageKey, JSON.stringify({ access_token: 'access' }));
  const record = repository.record;
  if (!record) throw new Error('expected encrypted record');
  record.ciphertext[0] ^= 1;
  await expect(client.getItem(storageKey)).rejects.toThrow(RuntimeStorageError);
  const changed = fixture({ attempt: 2 });
  changed.repository.record = repository.record;
  await expect(changed.storage.getItem(context({ attempt: 2 }).storageKey)).rejects.toThrow(
    RuntimeStorageError,
  );
  expect(() => fixture({ expiresAt: now - 1 })).toThrow(RuntimeStorageError);
  const unknown = fixture();
  unknown.repository.record = repository.record;
  if (!unknown.repository.record) throw new Error('expected encrypted record');
  unknown.repository.record.keyVersion = 'missing';
  await expect(unknown.storage.getItem(storageKey)).rejects.toThrow(RuntimeStorageError);
});
