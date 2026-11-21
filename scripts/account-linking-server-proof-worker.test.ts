import { expect, test } from 'bun:test';
import type { Session } from '@supabase/auth-js';
import { encryptEnvelope } from '../supabase/functions/account-linking/runtime/crypto.ts';
import { ServerProofWorker } from '../supabase/functions/account-linking/server/proof-worker.ts';
import type {
  ProofAcceptanceCommand,
  ProofAcceptanceControl,
  ProofAcceptanceLeg,
} from '../supabase/functions/account-linking/server/proof-worker.types.ts';
import { context, keyring, MemoryRepository, storage } from './account-linking-runtime-fixture.ts';

export const rawNonce = 'a'.repeat(64);
const proofSessionId = '55555555-5555-4555-8555-555555555555';
const session: Session = {
  access_token: 'signed-proof-jwt',
  refresh_token: 'sealed-refresh-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: 2_000_000_000,
  user: {
    id: 'source-user',
    aud: 'authenticated',
    app_metadata: {},
    user_metadata: {},
    created_at: '2026-01-01T00:00:00Z',
  },
};

async function nonceHash(): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.digest('SHA-256', Uint8Array.from(Buffer.from(rawNonce, 'hex'))),
  );
}

export async function fixture() {
  const repository = new MemoryRepository();
  const runtime = context({ purpose: 'proof', expiresAt: context().issuedAt + 600_000 });
  const leg: ProofAcceptanceLeg = {
    id: runtime.legId,
    revision: 7,
    state: 'exchanged',
    intentState: 'awaiting_source',
    expiresAt: runtime.expiresAt,
    runtime,
    nonceHash: await nonceHash(),
    side: 'source',
    active: true,
    expectedAuthUid: 'source-user',
  };
  repository.record = await encryptEnvelope(crypto, runtime, 2, 'v1', new Uint8Array(32), {
    slots: { [runtime.storageKey]: JSON.stringify(session) },
    ingestNonce: rawNonce,
  });
  let current = leg;
  let verifiedUserId: string | null = 'source-user';
  let verifiedSessionId: string | null = proofSessionId;
  let getUserError = false;
  const accepted: ProofAcceptanceCommand[] = [];
  const control: ProofAcceptanceControl<void> = {
    loadCanonical: async () => current,
    accept: async (command) => {
      accepted.push(command);
      current = {
        ...current,
        revision: current.revision + 1,
        state: 'proved',
        intentState: 'awaiting_target',
        provedAuthUid: 'source-user',
        provedSessionId: proofSessionId,
      };
    },
  };
  const calls = { getUser: 0 };
  return {
    worker: new ServerProofWorker({
      control,
      storage: () => storage(repository, { context: runtime, keyring: keyring() }),
      auth: () => ({
        getUser: async (token) => {
          calls.getUser++;
          return token === session.access_token && !getUserError
            ? { data: { user: verifiedUserId ? { id: verifiedUserId } : null }, error: null }
            : { data: { user: null }, error: new Error('invalid token') };
        },
        sessionId: () => verifiedSessionId,
      }),
    }),
    accepted,
    control,
    get current() {
      return current;
    },
    setCanonical(value: ProofAcceptanceLeg) {
      current = value;
    },
    setAuth(value: { userId?: string | null; sessionId?: string | null; error?: boolean }) {
      if ('userId' in value) verifiedUserId = value.userId ?? null;
      if ('sessionId' in value) verifiedSessionId = value.sessionId ?? null;
      if ('error' in value) getUserError = value.error ?? false;
    },
    calls,
    repository,
    runtime,
    hash: leg.nonceHash,
  };
}

test('accepts only a sealed proof JWT, then clears the nonce after canonical commit', async () => {
  const subject = await fixture();
  await expect(subject.worker.accept(undefined)).resolves.toEqual({
    intentId: subject.runtime.intentId,
    legId: subject.runtime.legId,
    state: 'awaiting_target',
    expiresAt: subject.runtime.expiresAt,
  });
  expect(subject.calls.getUser).toBe(1);
  expect(subject.accepted).toEqual([
    {
      intentId: subject.runtime.intentId,
      legId: subject.runtime.legId,
      ingestNonce: rawNonce,
      expectedLegRevision: 7,
      proofJwt: session.access_token,
    },
  ]);
  await expect(
    storage(subject.repository, { context: subject.runtime }).getIngestNonce(subject.hash),
  ).rejects.toThrow('nonce_missing');
});

test('a cleanup loss returns proved metadata on retry without accepting another proof', async () => {
  const subject = await fixture();
  subject.repository.onCompare = async () => {
    subject.repository.onCompare = null;
    throw new Error('cleanup unavailable');
  };
  await expect(subject.worker.accept(undefined)).resolves.toMatchObject({ state: 'awaiting_target' });
  await expect(subject.worker.accept(undefined)).resolves.toMatchObject({ state: 'awaiting_target' });
  expect(subject.accepted).toHaveLength(1);
  expect(subject.calls.getUser).toBe(2);
  await expect(
    storage(subject.repository, { context: subject.runtime }).getIngestNonce(subject.hash),
  ).rejects.toThrow('nonce_missing');
});
