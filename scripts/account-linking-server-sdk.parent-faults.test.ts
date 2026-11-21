import { expect, test } from 'bun:test';
import { ServerSdkWorker } from '../supabase/functions/account-linking/server/sdk-worker.ts';
import {
  harness,
  leg,
  nativeFetch,
  prime,
  session,
} from './account-linking-server-sdk.boundary-fixture.ts';

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

test('SDK persistence succeeds before its response fails: recover the same receipt without another code exchange', async () => {
  const h = harness();
  const key = h.current.runtime.storageKey;
  h.control.claimExchange = async (value) => {
    h.current = { ...value, state: 'exchanging', revision: value.revision + 1 };
    return { claimed: true, leg: h.current };
  };
  let failedAfterSave = false;
  let failures = 0;
  h.control.failExchange = async () => {
    failures += 1;
    throw new Error('must not discard the stored receipt');
  };
  const subject = new ServerSdkWorker({
    ...options(h),
    storage: (current) => {
      const encrypted = h.storageFor(current);
      const save = encrypted.setItem.bind(encrypted);
      encrypted.setItem = async (storageKey, value) => {
        await save(storageKey, value);
        if (storageKey === key && !failedAfterSave) {
          failedAfterSave = true;
          throw new Error('private failure after accepted storage CAS');
        }
      };
      return encrypted;
    },
  });
  const authorization = await subject.begin('request');
  expect(authorization.authorizationUrl).toContain('code_challenge=');
  const result = await subject.exchange('request', 'single-use-code');
  expect(failedAfterSave).toBe(true);
  expect(result).toMatchObject({ state: 'exchanged' });
  expect(h.calls.exchange).toBe(1);
  expect(h.calls.promote).toBe(1);
  expect(h.calls.getUser).toBe(1);
  expect(failures).toBe(0);
  const saved = JSON.parse((await h.storageFor(h.current).getItem(key)) ?? 'null');
  expect(saved.access_token).toBe(session().access_token);
  expect(saved.refresh_token).toBe(session().refresh_token);
  expect(JSON.stringify(result)).not.toContain('private');
});

test('a verified getUser identity differing from the SDK session identity is never promoted', async () => {
  const h = harness(leg({ state: 'exchanging' }));
  await prime(h);
  await h.storageFor(h.current).setItem(h.current.runtime.storageKey, JSON.stringify(session()));
  h.fetch = nativeFetch(h.calls, { userId: 'different-verified-user' });
  const result = await new ServerSdkWorker(options(h)).exchange('request', 'unused-code');
  expect(result.failure).toBe('exchange_failed');
  expect(h.calls.getUser).toBe(1);
  expect(h.calls.promote).toBe(0);
  expect(h.calls.exchange).toBe(0);
});

test('a failure recorder throwing sensitive text cannot reject the public operation with that text', async () => {
  const h = harness(leg({ state: 'exchanging', expectedAuthUid: 'wrong-source-user' }));
  await prime(h);
  await h.storageFor(h.current).setItem(h.current.runtime.storageKey, JSON.stringify(session()));
  h.control.failExchange = async () => {
    throw new Error('private-token-and-nonce');
  };
  const result = await new ServerSdkWorker(options(h)).exchange('request', 'unused-code');
  expect(result.failure).toBe('exchange_failed');
  expect(JSON.stringify(result)).not.toContain('private-token');
  expect(h.calls.promote).toBe(0);
});

test('a source receipt cannot be restored while the canonical intent awaits its target', async () => {
  const h = harness(leg({ state: 'exchanging', intentState: 'awaiting_target' }));
  await prime(h);
  await h.storageFor(h.current).setItem(h.current.runtime.storageKey, JSON.stringify(session()));
  let failures = 0;
  h.control.failExchange = async () => {
    failures += 1;
    throw new Error('not reached');
  };
  await new ServerSdkWorker(options(h)).exchange('request', 'unused-code');
  expect(h.calls.promote).toBe(0);
  expect(h.calls.getUser).toBe(0);
  expect(h.calls.exchange).toBe(0);
  expect(failures).toBe(0);
});
