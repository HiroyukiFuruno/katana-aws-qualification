import { expect, test } from 'bun:test';
import type { RuntimeRecord } from '../supabase/functions/account-linking/runtime/types.ts';
import {
  context,
  keyring,
  MemoryRepository,
  storage,
  storageKey,
} from './account-linking-runtime-fixture.ts';

const nonce = 'ab'.repeat(32);

async function expectedHash(hex = nonce): Promise<Uint8Array> {
  const raw = new Uint8Array(32);
  for (let index = 0; index < raw.length; index += 1)
    raw[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  return new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', raw));
}

class CountingRepository extends MemoryRepository {
  writes = 0;
  rejectWrite = false;

  override async compareAndSwap(
    leg: string,
    revision: number | null,
    next: RuntimeRecord,
  ): Promise<boolean> {
    this.writes += 1;
    if (this.rejectWrite) return false;
    return super.compareAndSwap(leg, revision, next);
  }
}

test('initialize and get reject wrong hashes, existing records, and CAS conflicts', async () => {
  const repository = new CountingRepository();
  const client = storage(repository, { keyring: keyring('v1', 7) });
  const expected = await expectedHash();
  await expect(client.getIngestNonce(expected)).rejects.toThrow('nonce_missing');
  await expect(client.initialize('AB'.repeat(32), expected)).rejects.toThrow('nonce_mismatch');
  await expect(client.initialize(nonce, await expectedHash('cd'.repeat(32)))).rejects.toThrow(
    'nonce_mismatch',
  );
  await client.initialize(nonce, expected);
  expect(repository.writes).toBe(1);
  await expect(client.initialize('cd'.repeat(32), expected)).rejects.toThrow('nonce_mismatch');
  await client.initialize(nonce, expected);
  expect(repository.writes).toBe(1);
  expect(await client.getIngestNonce(expected)).toBe(nonce);
  await expect(client.getIngestNonce(await expectedHash('cd'.repeat(32)))).rejects.toThrow(
    'nonce_mismatch',
  );

  const occupied = new MemoryRepository();
  const occupiedClient = storage(occupied);
  await occupiedClient.setItem(storageKey, '{"access_token":"session"}');
  await expect(occupiedClient.initialize(nonce, expected)).rejects.toThrow('nonce_mismatch');

  const conflicting = new CountingRepository();
  conflicting.rejectWrite = true;
  await expect(storage(conflicting).initialize(nonce, expected)).rejects.toThrow('cas_conflict');
  expect(conflicting.writes).toBe(1);
});

test('leg clear is rejected while proof clear preserves slots and permanently consumes nonce', async () => {
  const repository = new MemoryRepository();
  const expected = await expectedHash();
  const leg = storage(repository, { keyring: keyring('v1', 7) });
  await leg.initialize(nonce, expected);
  await leg.setItem(storageKey, '{"access_token":"session"}');
  await leg.setItem(`${storageKey}-code-verifier`, 'verifier');
  await expect(leg.clearIngestNonce(expected)).rejects.toThrow('nonce_mismatch');

  const proof = context({ purpose: 'proof', expiresAt: context().issuedAt + 600_000 });
  const record = repository.record;
  if (!record) throw new Error('missing initialized record');
  const { promoteEnvelope } = await import('../supabase/functions/account-linking/runtime/crypto.ts');
  repository.record = await promoteEnvelope(
    globalThis.crypto,
    context(),
    proof,
    record,
    new Uint8Array(32).fill(7),
    record.revision + 1,
    'v1',
    new Uint8Array(32).fill(7),
  );
  const confirmed = storage(repository, { context: proof, keyring: keyring('v1', 7) });
  await confirmed.clearIngestNonce(expected);
  expect(await confirmed.getItem(proof.storageKey)).toBe('{"access_token":"session"}');
  expect(await confirmed.getItem(`${proof.storageKey}-code-verifier`)).toBe('verifier');
  await expect(confirmed.getIngestNonce(expected)).rejects.toThrow('nonce_missing');
  await expect(confirmed.initialize(nonce, expected)).rejects.toThrow('nonce_mismatch');
  await expect(leg.initialize(nonce, expected)).rejects.toThrow('invalid_context');
});
