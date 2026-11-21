import { expect, test } from 'bun:test';
import { ServerSdkWorker } from '../supabase/functions/account-linking/server/sdk-worker.ts';
import { harness, leg, prime, uid } from './account-linking-server-sdk.boundary-fixture.ts';

const options = (h: ReturnType<typeof harness>) => ({
  control: h.control,
  storage: h.storageFor,
  url: 'https://auth.example',
  key: 'anon-key',
  providers: { github: { callback: 'https://app.example/callback', scopes: 'read:user' } },
  fetch: h.fetch,
});

test('authorization uses native SDK and never returns a URL without a claimed prepared leg', async () => {
  const h = harness();
  const result = await new ServerSdkWorker(options(h)).begin('request');
  expect(result.authorizationUrl).toStartWith('https://auth.example/auth/v1/authorize?');
  expect(result.authorizationUrl).toContain('provider=github');
  expect(result.authorizationUrl).toContain('code_challenge_method=s256');
  expect(h.calls.authorize).toBe(0);
  const cancelled = harness({ ...leg(), state: 'cancelled', intentState: 'awaiting_source' });
  expect(
    (await new ServerSdkWorker(options(cancelled)).begin('request')).authorizationUrl,
  ).toBeUndefined();
  const expired = harness({ ...leg(), state: 'expired', intentState: 'awaiting_source' });
  expect(
    (await new ServerSdkWorker(options(expired)).begin('request')).authorizationUrl,
  ).toBeUndefined();
  const terminal = harness();
  terminal.control.completeAuthorization = async (value) => ({
    ...value,
    active: false,
    intentState: 'cancelled',
    authorizationPrepared: true,
  });
  const terminalResult = await new ServerSdkWorker(options(terminal)).begin('request');
  expect(terminalResult.authorizationUrl).toBeUndefined();
});

test('missing or mismatched source expected UID cannot promote a session', async () => {
  for (const current of [
    leg({ expectedAuthUid: undefined }),
    leg({ expectedAuthUid: 'different-user' }),
  ]) {
    const h = harness(current);
    await prime(h);
    const result = await new ServerSdkWorker(options(h)).exchange('request', 'code');
    expect(result.state).not.toBe('proved');
    expect(result.failure).toBe('exchange_failed');
    expect(h.calls.promote).toBe(0);
    expect(uid).toBe('source-user');
  }
});

test('control failures and native SDK failures expose only fixed public failures', async () => {
  const h = harness();
  h.control.failAuthorization = async () => {
    throw new Error('authorization secret');
  };
  h.control.completeAuthorization = async () => {
    throw new Error('claim secret');
  };
  const result = await new ServerSdkWorker(options(h)).begin('request');
  expect(result.failure).toBe('authorization_failed');
  expect(JSON.stringify(result)).not.toContain('secret');
});
