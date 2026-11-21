import { expect, test } from 'bun:test';
import { ServerSdkWorker } from '../supabase/functions/account-linking/server/sdk-worker.ts';
import { verificationFixture } from './account-linking-server-sdk-verification-fixture.ts';

for (const failedReads of [1, 2] as const)
  test(`saved receipt survives ${failedReads} failed recovery metadata reads`, async () => {
    const { subject, worker, failures } = await verificationFixture(false);
    const load = subject.control.loadExchange;
    const promote = subject.control.promote;
    let reads = 0;
    let promotionFailed = false;
    subject.control.loadExchange = async (request) => {
      reads += 1;
      if (reads > 1 && reads <= failedReads + 1) throw new Error('temporary metadata outage');
      return load(request);
    };
    subject.control.promote = async (current) => {
      if (!promotionFailed) {
        promotionFailed = true;
        throw new Error('temporary promotion outage');
      }
      return promote(current);
    };
    const expiresAt = subject.current.expiresAt;
    const first = await worker.exchange('request', 'native-code');
    expect(first).toMatchObject(
      failedReads === 1 ? { state: 'exchanged' } : { state: 'exchanging', failure: 'runtime_failed' },
    );
    expect(failures).toEqual([]);
    expect(subject.current.expiresAt).toBe(expiresAt);
    expect(
      await subject.storageFor(subject.current).getItem(subject.current.runtime.storageKey),
    ).toContain('access-secret');
    expect(JSON.stringify(first)).not.toMatch(/access-secret|private/);
    await expect(worker.exchange('request', 'native-code')).resolves.toMatchObject({
      state: 'exchanged',
    });
    expect(subject.calls.exchange).toBe(1);
    expect(subject.calls.refresh).toBe(0);
  });

test('unavailable receipt storage does not establish receipt absence', async () => {
  const { subject, failures } = await verificationFixture(false);
  const promote = subject.control.promote;
  let unavailable = false;
  subject.control.promote = async (current) => {
    if (!unavailable) {
      unavailable = true;
      throw new Error('temporary promotion outage');
    }
    return promote(current);
  };
  let storageUnavailable = true;
  const worker = new ServerSdkWorker({
    control: subject.control,
    storage(current) {
      const storage = subject.storageFor(current);
      const read = storage.getItem.bind(storage);
      storage.getItem = async (key) => {
        if (unavailable && storageUnavailable) throw new Error('temporary encrypted storage outage');
        return read(key);
      };
      return storage;
    },
    url: 'https://auth.example',
    key: 'anon-key',
    providers: { github: { callback: 'https://app.example/callback', scopes: 'read:user' } },
    fetch: subject.fetch,
  });
  await expect(worker.exchange('request', 'native-code')).resolves.toMatchObject({
    state: 'exchanging',
    failure: 'runtime_failed',
  });
  expect(failures).toEqual([]);
  storageUnavailable = false;
  await expect(worker.exchange('request', 'native-code')).resolves.toMatchObject({ state: 'exchanged' });
  expect(subject.calls.exchange).toBe(1);
  expect(subject.calls.refresh).toBe(0);
});
