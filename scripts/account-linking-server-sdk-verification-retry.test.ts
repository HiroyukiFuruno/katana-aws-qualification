import { expect, test } from 'bun:test';
import {
  type VerificationMode,
  verificationFixture,
} from './account-linking-server-sdk-verification-fixture.ts';

for (const mode of ['unavailable', 'network', 'rateLimited', 'requestTimeout'] as const)
  test(`restored receipt survives ${mode} verification and resumes without code exchange`, async () => {
    const { subject, worker, failures, setMode } = await verificationFixture();
    const expiresAt = subject.current.expiresAt;
    const sealed = await subject.storageFor(subject.current).getItem(subject.current.runtime.storageKey);
    setMode(mode);
    const first = await worker.exchange('request', 'already-used-code');
    expect(first).toMatchObject({ state: 'exchanging', failure: 'runtime_failed' });
    expect(failures).toEqual([]);
    expect(subject.current.state).toBe('exchanging');
    expect(await subject.storageFor(subject.current).getItem(subject.current.runtime.storageKey)).toBe(
      sealed,
    );
    expect(await subject.storageFor(subject.current).getIngestNonce(subject.current.nonceHash)).toBe(
      '00'.repeat(32),
    );
    expect(subject.current.expiresAt).toBe(expiresAt);
    expect(JSON.stringify(first)).not.toMatch(/access-secret|private/);
    setMode('healthy');
    await expect(worker.exchange('request', 'already-used-code')).resolves.toMatchObject({
      state: 'exchanged',
    });
    expect(subject.calls.exchange).toBe(0);
    expect(subject.calls.refresh).toBe(0);
    expect(subject.calls.promote).toBe(1);
  });

test('a newly saved exchange receipt survives verification outage and is not exchanged twice', async () => {
  const { subject, worker, failures, setMode } = await verificationFixture(false);
  setMode('unavailable');
  await expect(worker.exchange('request', 'native-code')).resolves.toMatchObject({
    state: 'exchanging',
    failure: 'runtime_failed',
  });
  expect(failures).toEqual([]);
  expect(
    await subject.storageFor(subject.current).getItem(subject.current.runtime.storageKey),
  ).toContain('access-secret');
  setMode('healthy');
  await expect(worker.exchange('request', 'native-code')).resolves.toMatchObject({ state: 'exchanged' });
  expect(subject.calls.exchange).toBe(1);
  expect(subject.calls.refresh).toBe(0);
});

test('recovery preserves a saved receipt when identity verification becomes unavailable', async () => {
  const { subject, worker, failures, setMode, failPromotionOnce } = await verificationFixture(false);
  failPromotionOnce();
  await expect(worker.exchange('request', 'native-code')).resolves.toMatchObject({
    state: 'exchanging',
    failure: 'runtime_failed',
  });
  expect(failures).toEqual([]);
  setMode('healthy');
  await expect(worker.exchange('request', 'native-code')).resolves.toMatchObject({ state: 'exchanged' });
  expect(subject.calls.exchange).toBe(1);
  expect(subject.calls.refresh).toBe(0);
});

test('a fresh verified receipt remains recoverable when promotion temporarily fails twice', async () => {
  const { subject, worker, failures } = await verificationFixture(false);
  const promote = subject.control.promote;
  let temporaryFailures = 2;
  subject.control.promote = async (current) => {
    if (temporaryFailures > 0) {
      temporaryFailures -= 1;
      throw new Error('temporary promotion dependency failure');
    }
    return promote(current);
  };

  await expect(worker.exchange('request', 'native-code')).resolves.toMatchObject({
    state: 'exchanging',
    failure: 'runtime_failed',
  });
  expect(failures).toEqual([]);
  expect(temporaryFailures).toBe(0);
  expect(subject.current.state).toBe('exchanging');
  expect(
    await subject.storageFor(subject.current).getItem(subject.current.runtime.storageKey),
  ).toContain('access-secret');
  expect(subject.calls.exchange).toBe(1);
  expect(subject.calls.refresh).toBe(0);
  expect(subject.calls.getUser).toBe(2);

  await expect(worker.exchange('request', 'native-code')).resolves.toMatchObject({ state: 'exchanged' });
  expect(subject.calls.exchange).toBe(1);
  expect(subject.calls.refresh).toBe(0);
  expect(subject.calls.getUser).toBe(3);
  expect(subject.calls.promote).toBe(1);
});

for (const mode of ['invalid', 'mismatch'] satisfies VerificationMode[])
  test(`definitive ${mode} identity remains a known failure`, async () => {
    const { worker, failures, setMode } = await verificationFixture();
    setMode(mode);
    await expect(worker.exchange('request', 'already-used-code')).resolves.toMatchObject({
      state: 'failed',
      failure: 'exchange_failed',
    });
    expect(failures).toEqual([false]);
  });
