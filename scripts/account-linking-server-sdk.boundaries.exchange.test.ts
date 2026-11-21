import { expect, test } from 'bun:test';
import { ServerSdkWorker } from '../supabase/functions/account-linking/server/sdk-worker.ts';
import {
  harness,
  leg,
  nativeFetch,
  prime,
  session,
} from './account-linking-server-sdk.boundary-fixture.ts';

const options = (h: ReturnType<typeof harness>) => ({
  control: h.control,
  storage: h.storageFor,
  url: 'https://auth.example',
  key: 'anon-key',
  providers: { github: { callback: 'https://app.example/callback', scopes: 'read:user' } },
  fetch: h.fetch,
});

test('claimed false with no receipt does not exchange and does not fail another worker', async () => {
  const h = harness({ ...leg(), state: 'exchanging' });
  await prime(h);
  h.control.claimExchange = async (value) => ({
    claimed: false,
    leg: { ...value, state: 'exchanging' },
  });
  const result = await new ServerSdkWorker(options(h)).exchange('request', 'same-code');
  expect(result.state).toBe('exchanging');
  expect(h.calls.exchange).toBe(0);
  expect(h.calls.promote).toBe(0);
});

test('a saved receipt is recovered without exchanging the code again', async () => {
  const h = harness({ ...leg(), state: 'exchanging' });
  await prime(h);
  await h.storageFor(h.current).setItem(h.current.runtime.storageKey, JSON.stringify(session()));
  const result = await new ServerSdkWorker(options(h)).exchange('request', 'already-used');
  expect(result.state).toBe('exchanged');
  expect(h.calls.exchange).toBe(0);
});

test('network loss after an exchange receipt is recoverable with the same session', async () => {
  const h = harness({ ...leg(), state: 'exchanging' });
  await prime(h);
  const saved = session();
  await h.storageFor(h.current).setItem(h.current.runtime.storageKey, JSON.stringify(saved));
  h.fetch = nativeFetch(h.calls, { failToken: new Error('network-after-receipt') });
  const result = await new ServerSdkWorker(options(h)).exchange('request', 'code');
  expect(result.state).toBe('exchanged');
  expect(h.calls.exchange).toBe(0);
});

test('provider tokens never enter the receipt or public DTO', async () => {
  const h = harness({ ...leg(), state: 'exchanging' });
  await prime(h);
  await h.storageFor(h.current).setItem(h.current.runtime.storageKey, JSON.stringify(session()));
  h.fetch = nativeFetch(h.calls, {
    token: { ...session(), provider_token: 'provider-secret', provider_refresh_token: 'refresh-secret' },
  });
  const result = await new ServerSdkWorker(options(h)).exchange('request', 'code');
  expect(result.state).toBe('exchanged');
  expect(h.calls.getUser).toBe(1);
  const receipt: unknown = JSON.parse(
    (await h.storageFor(h.current).getItem(h.current.runtime.storageKey)) ?? 'null',
  );
  expect(receipt).toBeTruthy();
  expect(JSON.stringify(receipt)).not.toContain('provider-secret');
});

test('near-expiry saved SDK session does not delegate an implicit refresh', async () => {
  const h = harness({ ...leg(), state: 'exchanging' });
  await prime(h);
  const saved = { ...session(), expires_at: Math.floor(Date.now() / 1000) + 10 };
  const sdkStorage = h.storageFor(h.current);
  await sdkStorage.setItem(h.current.runtime.storageKey, JSON.stringify(saved));
  h.fetch = nativeFetch(h.calls, { token: session() });
  await new ServerSdkWorker(options(h)).exchange('request', 'code');
  expect(h.calls.refresh).toBe(0);
  expect(h.calls.promote).toBe(1);
  expect(h.calls.getUser).toBe(1);
  expect(await sdkStorage.getItem(h.current.runtime.storageKey)).toContain(saved.access_token);
});
