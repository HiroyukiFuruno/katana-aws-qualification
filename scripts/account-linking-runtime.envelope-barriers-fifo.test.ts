import { expect, test } from 'bun:test';
import { decryptEnvelope } from '../supabase/functions/account-linking/runtime/crypto.ts';
import { storageKey } from './account-linking-runtime-fixture.ts';
import {
  BarrierRepository,
  fixedFailure,
  gate,
  nonce,
  nonceHash,
  proofClient,
  storageWithCrypto,
} from './account-linking-runtime.envelope-barriers.ts';

test('initialize, SDK set, and remove wait behind the first real CAS', async () => {
  const repository = new BarrierRepository();
  const client = storageWithCrypto(repository, globalThis.crypto);
  const paused = gate();
  repository.casBarrier = paused;
  const expected = await nonceHash();
  const initialized = client.initialize(nonce, expected);
  await paused.entered;
  const set = client.setItem(storageKey, '{"access_token":"session"}');
  const removed = client.removeItem(storageKey);
  expect(repository.events.filter((event) => event === 'cas')).toEqual(['cas']);
  paused.release();
  await Promise.all([initialized, set, removed]);
  expect(repository.writes.map((record) => record.revision)).toEqual([0, 1, 2]);
  expect(await client.getIngestNonce(expected)).toBe(nonce);
  expect(await client.getItem(storageKey)).toBeNull();
});

test('clear, SDK mutations, and terminate share a FIFO and preserve each queued row', async () => {
  const repository = new BarrierRepository();
  const { client, context, expected } = await proofClient(repository);
  repository.events.length = 0;
  repository.writes.length = 0;
  const paused = gate();
  repository.casBarrier = paused;
  const cleared = client.clearIngestNonce(expected);
  await paused.entered;
  const session = client.setItem(context.storageKey, '{"access_token":"session"}');
  const verifierKey = `${context.storageKey}-code-verifier`;
  const verifier = client.setItem(verifierKey, 'verifier');
  const removed = client.removeItem(context.storageKey);
  const terminated = client.terminate();
  expect(repository.events.filter((event) => event === 'cas')).toEqual(['cas']);
  paused.release();
  await Promise.all([cleared, session, verifier, removed, terminated]);
  expect(repository.events.filter((event) => event === 'cas' || event === 'delete')).toEqual([
    'cas',
    'cas',
    'cas',
    'cas',
    'delete',
  ]);
  const rows = await Promise.all(
    repository.writes.map((record) =>
      decryptEnvelope(globalThis.crypto, context, record, new Uint8Array(32).fill(7)),
    ),
  );
  expect(rows[0]?.ingestNonce).toBeUndefined();
  expect(rows[1]?.slots[context.storageKey]).toContain('session');
  expect(rows[2]?.slots[verifierKey]).toBe('verifier');
  expect(rows[3]?.slots[context.storageKey]).toBeUndefined();
  expect(repository.record).toBeNull();
});

test('a failed mutation does not poison the FIFO for a following SDK write', async () => {
  const repository = new BarrierRepository();
  const client = storageWithCrypto(repository, globalThis.crypto);
  const expected = await nonceHash();
  await client.initialize(nonce, expected);
  const rejected = client.setItem(`${storageKey}-ingest-nonce`, 'session-secret');
  const written = client.setItem(storageKey, '{"access_token":"session"}');
  const error = await fixedFailure(rejected);
  expect(error.code).toBe('invalid_storage_key');
  expect(error.message).not.toContain('session-secret');
  await written;
  expect(await client.getItem(storageKey)).toBe('{"access_token":"session"}');
});
