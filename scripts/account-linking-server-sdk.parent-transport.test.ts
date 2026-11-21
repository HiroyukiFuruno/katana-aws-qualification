import { expect, test } from 'bun:test';
import { ServerSdkWorker } from '../supabase/functions/account-linking/server/sdk-worker.ts';
import { harness } from './account-linking-server-sdk.boundary-fixture.ts';

test('a retryable native exchange error without a saved receipt becomes exchange_unknown once', async () => {
  const h = harness();
  const upstream = h.fetch;
  let tokenRequests = 0;
  let unknownFailures = 0;
  h.fetch = async (input, init) => {
    if (String(input).includes('/token?grant_type=pkce')) {
      tokenRequests += 1;
      return Response.json({ message: 'private transport message' }, { status: 503 });
    }
    return upstream(input, init);
  };
  h.control.claimExchange = async (current) => {
    h.current = { ...current, state: 'exchanging', revision: current.revision + 1 };
    return { claimed: true, leg: h.current };
  };
  h.control.failExchange = async (current, unknown) => {
    expect(unknown).toBe(true);
    unknownFailures += 1;
    return { legId: current.id, state: 'exchange_unknown', expiresAt: current.expiresAt };
  };
  const worker = new ServerSdkWorker({
    control: h.control,
    storage: h.storageFor,
    url: 'https://auth.example',
    key: 'anon-key',
    providers: { github: { callback: 'https://app.example/callback', scopes: 'read:user' } },
    fetch: h.fetch,
  });
  expect((await worker.begin('request')).authorizationUrl).toBeDefined();
  const result = await worker.exchange('request', 'single-use-code');
  expect(result).toMatchObject({ state: 'exchange_unknown', failure: 'exchange_unknown' });
  expect(tokenRequests).toBe(1);
  expect(unknownFailures).toBe(1);
  expect(h.calls.promote).toBe(0);
  expect(JSON.stringify(result)).not.toContain('private');
});
