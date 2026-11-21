import { expect, test } from 'bun:test';
import {
  decryptEnvelope,
  encryptEnvelope,
  promoteEnvelope,
} from '../supabase/functions/account-linking/runtime/crypto.ts';
import type {
  RuntimeContext,
  RuntimeKeyring,
  RuntimeRecord,
} from '../supabase/functions/account-linking/runtime/types.ts';
import {
  context,
  keyring,
  MemoryRepository,
  storage,
  storageKey,
} from './account-linking-runtime-fixture.ts';

const nonce = 'ab'.repeat(32);
const oldKey = new Uint8Array(32).fill(7);
const newKey = new Uint8Array(32).fill(9);

async function hash(): Promise<Uint8Array> {
  const raw = new Uint8Array(32);
  for (let index = 0; index < raw.length; index += 1)
    raw[index] = Number.parseInt(nonce.slice(index * 2, index * 2 + 2), 16);
  return new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', raw));
}

function aad(value: RuntimeContext, version: string): Uint8Array {
  return new TextEncoder().encode(
    JSON.stringify([
      'kaq-proof-runtime-v1',
      version,
      value.purpose,
      value.intentId,
      value.legId,
      value.attempt,
      value.storageKey,
      value.issuedAt,
      value.expiresAt,
    ]),
  );
}

const rotatedKeyring: RuntimeKeyring = {
  active: async () => ({ version: 'v2', bytes: newKey }),
  resolve: async (version) => (version === 'v1' ? oldKey : version === 'v2' ? newKey : null),
};

test('promotion reencrypts the whole envelope for fixed proof context', async () => {
  const leg = context();
  const proof = context({ purpose: 'proof', expiresAt: leg.issuedAt + 600_000 });
  const before = await encryptEnvelope(globalThis.crypto, leg, 3, 'v1', oldKey, {
    slots: {
      [storageKey]: '{"access_token":"session"}',
      [`${storageKey}-code-verifier`]: 'verifier',
      [`${storageKey}-user`]: 'user',
    },
    ingestNonce: nonce,
  });
  const promoted = await promoteEnvelope(globalThis.crypto, leg, proof, before, oldKey, 4, 'v2', newKey);
  expect(promoted.expiresAt).toBe(proof.expiresAt);
  await expect(decryptEnvelope(globalThis.crypto, proof, promoted, newKey)).resolves.toEqual({
    slots: {
      [storageKey]: '{"access_token":"session"}',
      [`${storageKey}-code-verifier`]: 'verifier',
      [`${storageKey}-user`]: 'user',
    },
    ingestNonce: nonce,
  });
  await expect(decryptEnvelope(globalThis.crypto, leg, promoted, newKey)).rejects.toThrow(
    'decrypt_failed',
  );
  for (const changed of [
    { ...proof, intentId: '33333333-3333-4333-8333-333333333333' },
    { ...proof, legId: '44444444-4444-4444-8444-444444444444' },
    { ...proof, attempt: 2 },
    { ...proof, storageKey: `${proof.storageKey}-other` },
    { ...proof, issuedAt: proof.issuedAt + 1 },
  ])
    await expect(decryptEnvelope(globalThis.crypto, changed, promoted, newKey)).rejects.toThrow(
      'decrypt_failed',
    );
  expect(() =>
    storage(new MemoryRepository(), { context: { ...proof, expiresAt: proof.issuedAt + 600_001 } }),
  ).toThrow('invalid_context');
});

test('key rotation reads old records, writes the active key, and rejects unknown versions', async () => {
  const repository = new MemoryRepository();
  const original = storage(repository, { keyring: keyring('v1', 7) });
  await original.initialize(nonce, await hash());
  const rotated = storage(repository, { keyring: rotatedKeyring });
  await rotated.setItem(`${storageKey}-user`, 'user');
  const record = repository.record;
  if (!record) throw new Error('missing rotated record');
  expect(record.keyVersion).toBe('v2');
  await expect(decryptEnvelope(globalThis.crypto, context(), record, newKey)).resolves.toMatchObject({
    ingestNonce: nonce,
    slots: { [`${storageKey}-user`]: 'user' },
  });
  repository.record = { ...record, keyVersion: 'v3' };
  await expect(rotated.getItem(storageKey)).rejects.toThrow('unknown_key');
});

test('valid-AAD malformed plaintext is rejected by the envelope validator', async () => {
  const current = context();
  const cryptoKey = await globalThis.crypto.subtle.importKey('raw', oldKey, 'AES-GCM', false, [
    'encrypt',
  ]);
  const iv = new Uint8Array(12).fill(1);
  const malformed = new TextEncoder().encode('{"slots":[],"unexpected":true}');
  const ciphertext = new Uint8Array(
    await globalThis.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: aad(current, 'v1') },
      cryptoKey,
      malformed,
    ),
  );
  const record: RuntimeRecord = {
    revision: 0,
    keyVersion: 'v1',
    nonce: iv,
    ciphertext,
    expiresAt: current.expiresAt,
  };
  await expect(decryptEnvelope(globalThis.crypto, current, record, oldKey)).rejects.toThrow(
    'decrypt_failed',
  );
});
