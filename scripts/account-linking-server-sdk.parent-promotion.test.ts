import { expect, test } from 'bun:test';
import { ServerSdkWorker } from '../supabase/functions/account-linking/server/sdk-worker.ts';
import { harness, leg, prime, session } from './account-linking-server-sdk.boundary-fixture.ts';

for (const restored of [false, true]) {
  test(`durable promotion response loss returns canonical status (${restored ? 'restored' : 'new'} receipt)`, async () => {
    const h = harness(leg({ state: restored ? 'exchanging' : 'issued' }));
    let failures = 0;
    h.control.claimExchange = async (current) => {
      h.current = { ...current, state: 'exchanging', revision: current.revision + 1 };
      return { claimed: true, leg: h.current };
    };
    h.control.promote = async (current) => {
      h.current = {
        ...current,
        state: 'exchanged',
        revision: current.revision + 1,
        runtime: { ...current.runtime, purpose: 'proof' },
      };
      throw new Error('private response loss after durable promotion');
    };
    h.control.failExchange = async () => {
      failures += 1;
      throw new Error('canonical SQL rejects failure after promotion');
    };
    const subject = new ServerSdkWorker({
      control: h.control,
      storage: (current) => {
        if (h.current.state === 'exchanged' && current.runtime.purpose === 'leg')
          throw new Error('canonical proof phase rejects stale leg context');
        return h.storageFor(current);
      },
      url: 'https://auth.example',
      key: 'anon-key',
      providers: { github: { callback: 'https://app.example/callback', scopes: 'read:user' } },
      fetch: h.fetch,
    });
    if (restored) {
      await prime(h);
      await h.storageFor(h.current).setItem(h.current.runtime.storageKey, JSON.stringify(session()));
    } else {
      expect((await subject.begin('request')).authorizationUrl).toBeDefined();
    }
    const result = await subject.exchange('request', 'single-use-code');
    expect(result.state).toBe('exchanged');
    expect(result.failure).toBeUndefined();
    expect(result.restartRequired).toBeUndefined();
    expect(failures).toBe(0);
    expect(h.calls.exchange).toBe(restored ? 0 : 1);
    expect(h.calls.getUser).toBe(1);
    expect(JSON.stringify(result)).not.toContain('private');
  });
}
