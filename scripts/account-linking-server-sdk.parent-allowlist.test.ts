import { expect, test } from 'bun:test';
import { ServerSdkWorker } from '../supabase/functions/account-linking/server/sdk-worker.ts';
import { harness, leg } from './account-linking-server-sdk.boundary-fixture.ts';

test('inherited object properties are not configured OAuth providers', async () => {
  for (const provider of ['__proto__', 'constructor', 'toString']) {
    const h = harness(leg({ provider }));
    const result = await new ServerSdkWorker({
      control: h.control,
      storage: h.storageFor,
      url: 'https://auth.example',
      key: 'anon-key',
      providers: { github: { callback: 'https://app.example/callback', scopes: 'read:user' } },
      fetch: h.fetch,
    }).begin('request');
    expect(result.authorizationUrl).toBeUndefined();
    expect(result.failure).toBe('runtime_failed');
    expect(h.calls.claimed).toBe(0);
  }
});
