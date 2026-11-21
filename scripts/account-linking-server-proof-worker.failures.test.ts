import { expect, test } from 'bun:test';
import type { ProofAcceptanceLeg } from '../supabase/functions/account-linking/server/proof-worker.types.ts';
import { storage } from './account-linking-runtime-fixture.ts';
import { fixture, rawNonce } from './account-linking-server-proof-worker.test.ts';

async function expectNonce(subject: Awaited<ReturnType<typeof fixture>>) {
  await expect(
    storage(subject.repository, { context: subject.runtime }).getIngestNonce(subject.hash),
  ).resolves.toBe(rawNonce);
}

test('response loss after DB commit is retried as exact metadata and cleans the retained nonce', async () => {
  const subject = await fixture();
  const accept = subject.control.accept;
  subject.control.accept = async (command) => {
    await accept(command);
    throw new Error('response lost after commit');
  };
  const first = await subject.worker.accept(undefined);
  expect(JSON.stringify(first)).not.toMatch(/signed-proof|[a]{32}/);
  expect(first).toMatchObject({ failure: 'runtime_failed' });
  await expectNonce(subject);
  await expect(
    storage(subject.repository, { context: subject.runtime }).getItem(subject.runtime.storageKey),
  ).resolves.toContain('signed-proof-jwt');
  expect(subject.repository.record?.expiresAt).toBe(subject.runtime.expiresAt);
  await expect(subject.worker.accept(undefined)).resolves.toEqual({
    intentId: subject.runtime.intentId,
    legId: subject.runtime.legId,
    state: 'awaiting_target',
    expiresAt: subject.runtime.expiresAt,
  });
  expect(subject.accepted).toHaveLength(1);
  await expect(
    storage(subject.repository, { context: subject.runtime }).getIngestNonce(subject.hash),
  ).rejects.toThrow('nonce_missing');
});

const replacements: Array<{ label: string; apply(leg: ProofAcceptanceLeg): ProofAcceptanceLeg }> = [
  {
    label: 'intent',
    apply: (leg) => ({
      ...leg,
      runtime: { ...leg.runtime, intentId: '33333333-3333-4333-8333-333333333333' },
    }),
  },
  { label: 'leg', apply: (leg) => ({ ...leg, id: '44444444-4444-4444-8444-444444444444' }) },
  { label: 'phase', apply: (leg) => ({ ...leg, runtime: { ...leg.runtime, purpose: 'leg' } }) },
  { label: 'attempt', apply: (leg) => ({ ...leg, runtime: { ...leg.runtime, attempt: 2 } }) },
  { label: 'side', apply: (leg) => ({ ...leg, side: 'target' }) },
  { label: 'expected UID', apply: (leg) => ({ ...leg, expectedAuthUid: 'other-user' }) },
];

for (const replacement of replacements)
  test(`canonical ${replacement.label} replacement rejects cleanup without clearing nonce`, async () => {
    const subject = await fixture();
    const accept = subject.control.accept;
    subject.control.accept = async (command) => {
      await accept(command);
      subject.setCanonical(replacement.apply(subject.current));
    };
    await expect(subject.worker.accept(undefined)).resolves.toMatchObject({ failure: 'runtime_failed' });
    await expectNonce(subject);
  });

test('getUser failures and source UID mismatch preserve the nonce before SQL acceptance', async () => {
  for (const configure of [
    (subject: Awaited<ReturnType<typeof fixture>>) => subject.setAuth({ error: true }),
    (subject: Awaited<ReturnType<typeof fixture>>) => subject.setAuth({ userId: 'other-user' }),
    (subject: Awaited<ReturnType<typeof fixture>>) =>
      subject.setCanonical({ ...subject.current, expectedAuthUid: 'other-user' }),
  ]) {
    const subject = await fixture();
    configure(subject);
    await expect(subject.worker.accept(undefined)).resolves.toMatchObject({ failure: 'proof_failed' });
    expect(subject.accepted).toHaveLength(0);
    await expectNonce(subject);
  }
});

test('proved SID mismatch preserves canonical metadata and refuses nonce cleanup', async () => {
  const subject = await fixture();
  subject.repository.onCompare = async () => {
    subject.repository.onCompare = null;
    throw new Error('cleanup unavailable');
  };
  await subject.worker.accept(undefined);
  subject.setCanonical({ ...subject.current, provedSessionId: '66666666-6666-4666-8666-666666666666' });
  await expect(subject.worker.accept(undefined)).resolves.toEqual({
    intentId: subject.runtime.intentId,
    legId: subject.runtime.legId,
    state: 'awaiting_target',
    expiresAt: subject.runtime.expiresAt,
  });
  expect(subject.accepted).toHaveLength(1);
  await expectNonce(subject);
});

for (const sessionId of [null, 'not-a-session'])
  test(`unproved invalid session ID ${sessionId ?? 'missing'} never reaches SQL or clears nonce`, async () => {
    const subject = await fixture();
    subject.setAuth({ sessionId });
    await expect(subject.worker.accept(undefined)).resolves.toMatchObject({ failure: 'proof_failed' });
    expect(subject.accepted).toHaveLength(0);
    await expectNonce(subject);
  });

test('SQL failure before commit retains the original session and nonce', async () => {
  const subject = await fixture();
  const before = { ...subject.repository.record };
  subject.control.accept = async () => {
    throw new Error('database unavailable with secret details');
  };
  const result = await subject.worker.accept(undefined);
  expect(result).toMatchObject({ failure: 'runtime_failed', state: 'awaiting_source' });
  expect(JSON.stringify(result)).not.toContain('secret details');
  expect(subject.accepted).toHaveLength(0);
  expect(subject.repository.record).toEqual(before);
  await expectNonce(subject);
});
