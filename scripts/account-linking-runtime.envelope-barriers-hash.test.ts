import { expect, test } from 'bun:test';
import { Buffer } from 'node:buffer';
import {
  BarrierRepository,
  cryptoBarrier,
  gate,
  nonce,
  nonceHash,
  proofClient,
  storageWithCrypto,
} from './account-linking-runtime.envelope-barriers.ts';
import { storage } from './account-linking-runtime-fixture.ts';

test('get snapshots a raw-32 hash while repository read is paused', async () => {
  const repository = new BarrierRepository();
  const client = storage(repository);
  const expected = await nonceHash();
  await client.initialize(nonce, expected);
  const paused = gate();
  repository.readBarrier = paused;
  const pending = client.getIngestNonce(expected);
  await paused.entered;
  expected.fill(0);
  paused.release();
  expect(await pending).toBe(nonce);
  expect(repository.events).toContain('read');
});

test('get copies database Buffer bytes without keeping its slice view', async () => {
  const repository = new BarrierRepository();
  const client = storage(repository);
  const expected = Buffer.from(await nonceHash());
  await client.initialize(nonce, expected);
  const paused = gate();
  repository.readBarrier = paused;
  const pending = client.getIngestNonce(expected);
  await paused.entered;
  expected.fill(0);
  paused.release();
  expect(await pending).toBe(nonce);
});

test('get snapshots a raw-32 hash while real WebCrypto digest is paused', async () => {
  const repository = new BarrierRepository();
  const expected = await nonceHash();
  await storageWithCrypto(repository, globalThis.crypto).initialize(nonce, expected);
  const paused = gate();
  const client = storageWithCrypto(repository, cryptoBarrier('digest', paused));
  const pending = client.getIngestNonce(expected);
  await paused.entered;
  expected.fill(0);
  paused.release();
  expect(await pending).toBe(nonce);
});

test('clear snapshots a raw-32 hash while repository read is paused', async () => {
  const repository = new BarrierRepository();
  const { client, expected, context } = await proofClient(repository);
  const session = '{"access_token":"session"}';
  await client.setItem(context.storageKey, session);
  const paused = gate();
  repository.readBarrier = paused;
  const pending = client.clearIngestNonce(expected);
  await paused.entered;
  expected.fill(0);
  paused.release();
  await pending;
  repository.readBarrier = null;
  expect(await client.getItem(context.storageKey)).toBe(session);
  await expect(client.getIngestNonce(await nonceHash())).rejects.toThrow('nonce_missing');
});

test('clear snapshots a raw-32 hash while real WebCrypto digest is paused', async () => {
  const repository = new BarrierRepository();
  const { expected, context } = await proofClient(repository);
  const paused = gate();
  const client = storageWithCrypto(repository, cryptoBarrier('digest', paused), context);
  const pending = client.clearIngestNonce(expected);
  await paused.entered;
  expected.fill(0);
  paused.release();
  await pending;
  expect(await client.getItem(context.storageKey)).toBeNull();
  await expect(client.getIngestNonce(await nonceHash())).rejects.toThrow('nonce_missing');
});
