import { expect, test } from 'bun:test';
import { fixture, initialize } from './account-linking-server-sdk.fixture.ts';

test('uses native PKCE only after its authorization claim and returns metadata only', async () => {
  const subject = fixture();
  const value = await subject.worker.begin();
  expect(value).toEqual({
    legId: subject.leg.id,
    state: 'issued',
    expiresAt: subject.leg.expiresAt,
    authorizationUrl: expect.stringContaining('/authorize?'),
  });
  expect(subject.calls.complete).toBe(1);
  expect(subject.repository.record?.revision).toBeGreaterThan(0);
  expect(JSON.stringify(value)).not.toContain('secret');
});

test('replay never initializes AuthClient or issues another verifier', async () => {
  const subject = fixture();
  subject.control.claimAuthorization = async () => ({ claimed: false });
  await expect(subject.worker.begin()).resolves.toMatchObject({ legId: subject.leg.id });
  expect(subject.repository.record?.revision).toBe(0);
});

test('claimed exchange replay without a sealed receipt only requests an explicit restart', async () => {
  const subject = fixture({ state: 'exchanging' });
  await initialize(subject, 'c'.repeat(64));
  await expect(subject.worker.exchange(undefined, 'single-use-code')).resolves.toMatchObject({
    restartRequired: true,
  });
  expect(subject.calls.fail).toBe(0);
  expect(subject.calls.promote).toBe(0);
});

test('restores only the sealed SDK session in exchanging state and promotes its verified source', async () => {
  const subject = fixture({ state: 'exchanging' });
  const { current, session } = await initialize(subject, 'a'.repeat(64));
  await current.setItem(subject.leg.runtime.storageKey, JSON.stringify(session));
  await expect(subject.worker.exchange(undefined, 'never-used')).resolves.toMatchObject({
    state: 'exchanged',
  });
  expect(subject.calls.promote).toBe(1);
  expect(await current.getItem(subject.leg.runtime.storageKey)).not.toContain('provider-secret');
});

test('terminal prepared replay and an untrusted source UID do not promote or expose dependency errors', async () => {
  const terminal = fixture({ active: false, authorizationPrepared: true });
  await expect(terminal.worker.begin()).resolves.toMatchObject({ state: 'issued' });
  expect(terminal.repository.record).toBeNull();
  const mismatched = fixture({ state: 'exchanging', expectedAuthUid: 'other-user' });
  const { current, session } = await initialize(mismatched, 'b'.repeat(64));
  await current.setItem(mismatched.leg.runtime.storageKey, JSON.stringify(session));
  const value = await mismatched.worker.exchange(undefined, 'never-used');
  expect(value).toMatchObject({ state: 'failed', failure: 'exchange_failed' });
  expect(JSON.stringify(value)).not.toContain('source-user');
  expect(mismatched.calls.promote).toBe(0);
});
