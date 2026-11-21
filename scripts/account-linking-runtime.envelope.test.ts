import { expect, test } from 'bun:test';
import {
  decryptEnvelope,
  encryptEnvelope,
  promoteEnvelope,
} from '../supabase/functions/account-linking/runtime/crypto.ts';
import { RuntimeStorageError } from '../supabase/functions/account-linking/runtime/pkce-storage.ts';
import { isEnvelope } from '../supabase/functions/account-linking/runtime/slots.ts';
import {
  context,
  keyring,
  MemoryRepository,
  storage,
  storageKey,
} from './account-linking-runtime-fixture.ts';

const nonce = 'ab'.repeat(32);

async function hash(value = nonce): Promise<Uint8Array> {
  const pairs = value.match(/.{2}/g);
  if (!pairs) throw new Error('invalid nonce fixture');
  const raw = Uint8Array.from(pairs.map((part) => Number.parseInt(part, 16)));
  return new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', raw));
}

test('strict envelope shape keeps nonce private and slots compatible', async () => {
  expect(isEnvelope({ slots: {} })).toBeTrue();
  for (const invalid of [
    { slots: [] },
    { slots: null },
    { slots: {}, extra: true },
    { slots: {}, ingestNonce: null },
    { slots: {}, ingestNonce: 'AB'.repeat(32) },
    { slots: {}, ingestNonce: 'ab' },
  ])
    expect(isEnvelope(invalid)).toBeFalse();
  const material = new Uint8Array(32).fill(7);
  const current = context();
  const record = await encryptEnvelope(globalThis.crypto, current, 0, 'v1', material, {
    slots: { [storageKey]: '{"access_token":"session"}' },
    ingestNonce: nonce,
  });
  await expect(decryptEnvelope(globalThis.crypto, current, record, material)).resolves.toMatchObject({
    slots: { [storageKey]: '{"access_token":"session"}' },
    ingestNonce: nonce,
  });
  const malformed = new TextEncoder().encode('{"slots":[],"unexpected":true}');
  const bad = {
    ...record,
    ciphertext: new Uint8Array(
      await globalThis.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: record.nonce, additionalData: new TextEncoder().encode('wrong') },
        await globalThis.crypto.subtle.importKey('raw', material, { name: 'AES-GCM' }, false, [
          'encrypt',
        ]),
        malformed,
      ),
    ),
  };
  await expect(decryptEnvelope(globalThis.crypto, current, bad, material)).rejects.toThrow(
    RuntimeStorageError,
  );
});

test('nonce initialization replays without write, fences mismatch, and proof clear preserves slots', async () => {
  const repository = new MemoryRepository();
  const leg = storage(repository, { keyring: keyring('v1', 7) });
  const expected = await hash();
  await leg.initialize(nonce, expected);
  const record = repository.record;
  await leg.initialize(nonce, expected);
  expect(repository.record).toBe(record);
  await expect(leg.initialize('cd'.repeat(32), expected)).rejects.toThrow('nonce_mismatch');
  expect(await leg.getIngestNonce(expected)).toBe(nonce);
  const proof = context({ purpose: 'proof', expiresAt: context().issuedAt + 600_000 });
  if (!record) throw new Error('missing record');
  repository.record = await promoteEnvelope(
    globalThis.crypto,
    context(),
    proof,
    record,
    new Uint8Array(32).fill(7),
    1,
    'v1',
    new Uint8Array(32).fill(7),
  );
  const confirmed = storage(repository, { context: proof, keyring: keyring('v1', 7) });
  await confirmed.setItem(proof.storageKey, '{"access_token":"session"}');
  await confirmed.clearIngestNonce(expected);
  expect(await confirmed.getItem(proof.storageKey)).toBe('{"access_token":"session"}');
  await expect(confirmed.getIngestNonce(expected)).rejects.toThrow('nonce_missing');
});

test('SDK mutations preserve nonce, strip providers, and do not expose it as a storage item', async () => {
  const repository = new MemoryRepository();
  const client = storage(repository, { keyring: keyring('v1', 7) });
  const expected = await hash();
  await client.initialize(nonce, expected);
  await client.setItem(storageKey, JSON.stringify({ access_token: 'access', provider_token: 'secret' }));
  await client.setItem(`${storageKey}-code-verifier`, 'verifier');
  await client.removeItem(storageKey);
  expect(await client.getIngestNonce(expected)).toBe(nonce);
  expect(await client.getItem(`${storageKey}-code-verifier`)).toBe('verifier');
  expect(await client.getItem(storageKey)).toBeNull();
  await expect(client.getItem(`${storageKey}-ingest-nonce`)).rejects.toThrow('invalid_storage_key');
  const record = repository.record;
  if (!record) throw new Error('missing encrypted envelope');
  const envelope = await decryptEnvelope(
    globalThis.crypto,
    context(),
    record,
    new Uint8Array(32).fill(7),
  );
  expect(JSON.stringify(envelope)).not.toContain('secret');
});

test('initialization fences nonce-less records and snapshots the caller hash before queued work', async () => {
  const repository = new MemoryRepository();
  const client = storage(repository);
  await client.setItem(storageKey, '{"access_token":"session"}');
  const expected = await hash();
  await expect(client.initialize(nonce, expected)).rejects.toThrow('nonce_mismatch');
  const blocked = new MemoryRepository();
  const gate = Promise.withResolvers<void>();
  blocked.onCompare = () => gate.promise;
  const queued = storage(blocked);
  const first = queued.initialize(nonce, await hash());
  const copied = await hash();
  const replay = queued.initialize(nonce, copied);
  copied.fill(0);
  gate.resolve();
  await first;
  await expect(replay).resolves.toBeUndefined();
});
