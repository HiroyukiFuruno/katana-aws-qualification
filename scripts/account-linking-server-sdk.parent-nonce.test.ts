import { expect, test } from 'bun:test';
import { ServerSdkWorker } from '../supabase/functions/account-linking/server/sdk-worker.ts';
import { harness, prime } from './account-linking-server-sdk.boundary-fixture.ts';

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

test('nonce persistence failure prevents any authorization claim or SDK verifier write', async () => {
  const h = harness();
  let verifierWrites = 0;
  const worker = new ServerSdkWorker({
    ...options(h),
    storage: (current) => {
      const encrypted = h.storageFor(current);
      encrypted.initialize = async () => {
        throw new Error('private nonce persistence error');
      };
      encrypted.setItem = async () => {
        verifierWrites += 1;
      };
      return encrypted;
    },
  });
  const result = await worker.begin('request');
  expect(result.authorizationUrl).toBeUndefined();
  expect(result.failure).toBe('runtime_failed');
  expect(h.calls.claimed).toBe(0);
  expect(verifierWrites).toBe(0);
  expect(JSON.stringify(result)).not.toContain('private');
  await expect(h.storageFor(h.current).getIngestNonce(h.current.nonceHash)).rejects.toMatchObject({
    code: 'nonce_missing',
  });
});

test('a mismatching canonical nonce hash prevents code exchange and failure mutation', async () => {
  const h = harness();
  await prime(h);
  h.current = { ...h.current, nonceHash: new Uint8Array(32) };
  let claims = 0;
  let failures = 0;
  h.control.claimExchange = async (current) => {
    claims += 1;
    return { claimed: true, leg: current };
  };
  h.control.failExchange = async () => {
    failures += 1;
    throw new Error('not reached');
  };
  const result = await new ServerSdkWorker(options(h)).exchange('request', 'unused-code');
  expect(result.failure).toBe('runtime_failed');
  expect(claims).toBe(0);
  expect(failures).toBe(0);
  expect(h.calls.exchange).toBe(0);
  expect(h.calls.getUser).toBe(0);
});
