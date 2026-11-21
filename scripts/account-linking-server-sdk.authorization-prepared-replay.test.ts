import { expect, test } from 'bun:test';
import { ServerSdkWorker } from '../supabase/functions/account-linking/server/sdk-worker.ts';
import { harness } from './account-linking-server-sdk.boundary-fixture.ts';

test('a prepared authorization with a lost response retains its success and requires explicit restart', async () => {
  const h = harness();
  h.current = { ...h.current, revision: 0, authorizationPrepared: false };
  let failureMutations = 0;
  let verifierSaved = false;
  h.control.claimAuthorization = async (current) => {
    h.current = { ...current, revision: current.revision + 1 };
    return { claimed: true, claimId: 'native-claim' };
  };
  h.control.completeAuthorization = async (current) => {
    verifierSaved = !!(await h
      .storageFor(current)
      .getItem(`${current.runtime.storageKey}-code-verifier`));
    h.current = { ...current, revision: current.revision + 1, authorizationPrepared: true };
    throw new Error('private response loss after preparation committed');
  };
  h.control.failAuthorization = async (current) => {
    failureMutations += 1;
    h.current = { ...current, state: 'failed', revision: current.revision + 1 };
    return { legId: current.id, state: 'failed', expiresAt: current.expiresAt };
  };
  const result = await new ServerSdkWorker({
    control: h.control,
    storage: h.storageFor,
    url: 'https://auth.example',
    key: 'anon-key',
    providers: { github: { callback: 'https://app.example/callback', scopes: 'read:user' } },
    fetch: h.fetch,
  }).begin('request');
  expect(verifierSaved).toBe(true);
  expect(h.current.authorizationPrepared).toBe(true);
  expect(h.current.revision).toBe(2);
  expect(h.current.state).toBe('issued');
  expect(failureMutations).toBe(0);
  expect(result).toMatchObject({ state: 'issued', restartRequired: true });
  expect(result.failure).toBeUndefined();
  expect(result.authorizationUrl).toBeUndefined();
  expect(JSON.stringify(result)).not.toContain('private');
  expect(h.calls.exchange).toBe(0);
});
