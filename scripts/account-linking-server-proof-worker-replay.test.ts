import { expect, test } from 'bun:test';
import { storage } from './account-linking-runtime-fixture.ts';
import { fixture, rawNonce } from './account-linking-server-proof-worker.test.ts';

for (const retainedNonce of [true, false])
  test(`committed metadata survives Auth outage when nonce is ${retainedNonce ? 'retained' : 'cleared'}`, async () => {
    const subject = await fixture();
    if (retainedNonce)
      subject.repository.onCompare = async () => {
        subject.repository.onCompare = null;
        throw new Error('cleanup unavailable');
      };
    await subject.worker.accept(undefined);
    subject.setAuth({ error: true });
    const before = structuredClone(subject.repository.record);
    await expect(subject.worker.accept(undefined)).resolves.toEqual({
      intentId: subject.runtime.intentId,
      legId: subject.runtime.legId,
      state: 'awaiting_target',
      expiresAt: subject.runtime.expiresAt,
    });
    expect(subject.accepted).toHaveLength(1);
    expect(subject.repository.record).toEqual(before);
    const read = storage(subject.repository, { context: subject.runtime }).getIngestNonce(subject.hash);
    if (retainedNonce) await expect(read).resolves.toBe(rawNonce);
    else {
      await expect(read).rejects.toThrow('nonce_missing');
      expect(subject.calls.getUser).toBe(1);
    }
  });

test('a source without its expected UID is rejected before Auth, SQL or nonce cleanup', async () => {
  const subject = await fixture();
  subject.setCanonical({ ...subject.current, expectedAuthUid: undefined });
  await expect(subject.worker.accept(undefined)).resolves.toMatchObject({ failure: 'proof_failed' });
  expect(subject.calls.getUser).toBe(0);
  expect(subject.accepted).toHaveLength(0);
  await expect(
    storage(subject.repository, { context: subject.runtime }).getIngestNonce(subject.hash),
  ).resolves.toBe(rawNonce);
});
