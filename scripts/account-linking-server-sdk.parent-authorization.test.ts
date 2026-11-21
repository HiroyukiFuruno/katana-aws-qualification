import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';
import { ServerSdkWorker } from '../supabase/functions/account-linking/server/sdk-worker.ts';
import { harness } from './account-linking-server-sdk.boundary-fixture.ts';

function options(h: ReturnType<typeof harness>) {
  return {
    control: h.control,
    storage: h.storageFor,
    url: 'https://auth.example',
    key: 'anon-key',
    providers: { github: { callback: 'https://app.example/callback', scopes: 'read:user' } },
    fetch: h.fetch,
  };
}

test('authorization URL uses server configuration and contains neither the ingest nonce nor its hash', async () => {
  const h = harness();
  let preparedAfterVerifier = false;
  h.control.completeAuthorization = async (current) => {
    const verifier = await h.storageFor(current).getItem(`${current.runtime.storageKey}-code-verifier`);
    preparedAfterVerifier = typeof verifier === 'string' && verifier.length > 0;
    return { ...current, authorizationPrepared: true };
  };
  const result = await new ServerSdkWorker(options(h)).begin('request');
  expect(preparedAfterVerifier).toBe(true);
  expect(result.authorizationUrl).toBeDefined();
  assert.ok(result.authorizationUrl);
  const url = new URL(result.authorizationUrl);
  expect(url.searchParams.get('redirect_to')).toBe('https://app.example/callback');
  expect(url.searchParams.get('scopes')).toBe('read:user');
  expect(url.searchParams.get('provider')).toBe('github');
  const ingest = await h.storageFor(h.current).getIngestNonce(h.current.nonceHash);
  expect(result.authorizationUrl).not.toContain(ingest);
  expect(result.authorizationUrl).not.toContain(Buffer.from(h.current.nonceHash).toString('hex'));
});

test('a lost authorization response requires explicit restart without issuing a second verifier', async () => {
  const h = harness();
  const subject = new ServerSdkWorker(options(h));
  expect((await subject.begin('request')).authorizationUrl).toBeDefined();
  const key = `${h.current.runtime.storageKey}-code-verifier`;
  const original = await h.storageFor(h.current).getItem(key);
  h.control.openAuthorization = async () => h.current;
  h.control.claimAuthorization = async () => ({ claimed: false });
  const replay = await subject.begin('request');
  expect(replay.authorizationUrl).toBeUndefined();
  expect(replay.restartRequired).toBe(true);
  expect(await h.storageFor(h.current).getItem(key)).toBe(original);
});

test('verifier persistence failure never returns an authorization URL or marks it prepared', async () => {
  const h = harness();
  let prepared = 0;
  let attempts = 0;
  h.control.completeAuthorization = async (current) => {
    prepared += 1;
    return { ...current, authorizationPrepared: true };
  };
  const result = await new ServerSdkWorker({
    ...options(h),
    storage: (current) => {
      const encrypted = h.storageFor(current);
      encrypted.setItem = async () => {
        attempts += 1;
        throw new Error('private verifier failure');
      };
      return encrypted;
    },
  }).begin('request');
  expect(attempts).toBe(1);
  expect(prepared).toBe(0);
  expect(result.authorizationUrl).toBeUndefined();
  expect(result.failure).toBe('authorization_failed');
  expect(JSON.stringify(result)).not.toContain('private');
});
