import { expect, test } from 'bun:test';
import { ServerSdkWorker } from '../supabase/functions/account-linking/server/sdk-worker.ts';
import type { ServerSdkLeg } from '../supabase/functions/account-linking/server/sdk-worker.types.ts';
import { harness } from './account-linking-server-sdk.boundary-fixture.ts';

function fixture(beforeFailure?: (h: ReturnType<typeof harness>) => void, lostReply = false) {
  const h = harness();
  h.current = { ...h.current, revision: 0, authorizationPrepared: false };
  const attemptedRevisions: number[] = [];
  h.control.claimAuthorization = async (current) => {
    h.current = { ...current, revision: current.revision + 1 };
    return { claimed: true, claimId: 'native-claim' };
  };
  h.control.failAuthorization = async (current) => {
    attemptedRevisions.push(current.revision);
    if (current.revision !== h.current.revision) throw new Error('KAQ_EXCHANGE_STALE');
    h.current = { ...current, state: 'failed', revision: current.revision + 1 };
    if (lostReply) throw new Error('private response loss after recording failure');
    return { legId: current.id, state: 'failed', expiresAt: current.expiresAt };
  };
  const worker = new ServerSdkWorker({
    control: h.control,
    storage: (current) => {
      const encrypted = h.storageFor(current);
      encrypted.setItem = async () => {
        beforeFailure?.(h);
        throw new Error('private verifier persistence failure');
      };
      return encrypted;
    },
    url: 'https://auth.example',
    key: 'anon-key',
    providers: { github: { callback: 'https://app.example/callback', scopes: 'read:user' } },
    fetch: h.fetch,
  });
  return { h, worker, attemptedRevisions };
}

test('authorization failure uses the canonical post-claim revision', async () => {
  const { h, worker, attemptedRevisions } = fixture();
  const result = await worker.begin('request');
  expect(result).toMatchObject({ state: 'failed', failure: 'authorization_failed' });
  expect(h.current.revision).toBe(2);
  expect(attemptedRevisions).toEqual([1]);
  expect(result.authorizationUrl).toBeUndefined();
  expect(JSON.stringify(result)).not.toContain('private');
});

const terminal: Partial<ServerSdkLeg>[] = [
  { state: 'superseded' },
  { state: 'exchanging' },
  { state: 'exchanged' },
  { state: 'proved' },
  { active: false, intentState: 'cancelled' },
];
for (const metadata of terminal) {
  test(`late authorization failure preserves ${JSON.stringify(metadata)}`, async () => {
    const { h, worker, attemptedRevisions } = fixture((subject) => {
      subject.current = { ...subject.current, ...metadata };
    });
    const result = await worker.begin('request');
    expect(result.state).toBe(h.current.state);
    expect(attemptedRevisions).toEqual([]);
    expect(h.current.revision).toBe(1);
    expect(result.authorizationUrl).toBeUndefined();
  });
}

test('a replacement leg is never failed by the old authorization attempt', async () => {
  const { h, worker, attemptedRevisions } = fixture((subject) => {
    subject.current = { ...subject.current, id: '33333333-3333-4333-8333-333333333333' };
  });
  await worker.begin('request');
  expect(attemptedRevisions).toEqual([]);
  expect(h.current.state).toBe('issued');
  expect(h.current.revision).toBe(1);
});

test('a committed failure with a lost response returns its latest failed status', async () => {
  const { h, worker, attemptedRevisions } = fixture(undefined, true);
  const result = await worker.begin('request');
  expect(result.state).toBe('failed');
  expect(h.current.state).toBe('failed');
  expect(h.current.revision).toBe(2);
  expect(attemptedRevisions).toEqual([1]);
  expect(JSON.stringify(result)).not.toContain('private');
});
