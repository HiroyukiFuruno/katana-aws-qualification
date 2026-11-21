import { expect, test } from 'bun:test';
import { context, keyring, now, storage } from './account-linking-runtime-fixture.ts';
import {
  BarrierRepository,
  cryptoBarrier,
  fixedFailure,
  gate,
  nonce,
  nonceHash,
  storageWithCrypto,
  type Gate,
} from './account-linking-runtime.envelope-barriers.ts';

type Paused = {
  barrier: Gate;
  pending: Promise<unknown>;
  repository: BarrierRepository;
  expire(): void;
  secret: string;
  before: unknown;
};

async function prepared(): Promise<{
  client: ReturnType<typeof storageWithCrypto>;
  context: ReturnType<typeof context>;
  expected: Uint8Array;
  repository: BarrierRepository;
  expire(): void;
}> {
  const repository = new BarrierRepository();
  const runtime = context();
  let timestamp = now;
  const client = storageWithCrypto(repository, globalThis.crypto, runtime, () => timestamp);
  const expected = await nonceHash();
  await client.initialize(nonce, expected);
  return {
    client,
    context: runtime,
    expected,
    repository,
    expire: () => {
      timestamp = runtime.expiresAt;
    },
  };
}

function exercise(label: string, pause: () => Promise<Paused>): void {
  for (const terminal of [false, true]) {
    const code = terminal ? 'terminal' : 'expired';
    test(`${label} returns fixed ${code} without exposing a nonce or session`, async () => {
      const state = await pause();
      await state.barrier.entered;
      if (terminal) state.repository.terminal = true;
      else state.expire();
      state.barrier.release();
      const error = await fixedFailure(state.pending);
      expect(error.code).toBe(code);
      expect(error.message).not.toContain(nonce);
      expect(error.message).not.toContain(state.secret);
      expect(state.repository.record).toBe(state.before);
    });
  }
}

exercise('get after repository read', async () => {
  const state = await prepared();
  const barrier = gate();
  state.repository.readBarrier = barrier;
  return {
    barrier,
    pending: state.client.getIngestNonce(state.expected),
    ...state,
    secret: 'session-secret',
    before: state.repository.record,
  };
});

exercise('get after real WebCrypto digest', async () => {
  const state = await prepared();
  const barrier = gate();
  let timestamp = now;
  const client = storageWithCrypto(
    state.repository,
    cryptoBarrier('digest', barrier),
    state.context,
    () => timestamp,
  );
  return {
    barrier,
    pending: client.getIngestNonce(state.expected),
    repository: state.repository,
    expire: () => {
      timestamp = state.context.expiresAt;
    },
    secret: 'session-secret',
    before: state.repository.record,
  };
});

exercise('get after key resolution', async () => {
  const state = await prepared();
  const barrier = gate();
  const keys = keyring('v1', 7);
  let timestamp = now;
  const client = storage(state.repository, {
    context: state.context,
    now: () => timestamp,
    keyring: {
      active: keys.active,
      resolve: async (version) => {
        await barrier.pause();
        return keys.resolve(version);
      },
    },
  });
  return {
    barrier,
    pending: client.getIngestNonce(state.expected),
    repository: state.repository,
    expire: () => {
      timestamp = state.context.expiresAt;
    },
    secret: 'session-secret',
    before: state.repository.record,
  };
});

exercise('get after real WebCrypto decrypt', async () => {
  const state = await prepared();
  const barrier = gate();
  let timestamp = now;
  const client = storageWithCrypto(
    state.repository,
    cryptoBarrier('decrypt', barrier),
    state.context,
    () => timestamp,
  );
  return {
    barrier,
    pending: client.getIngestNonce(state.expected),
    repository: state.repository,
    expire: () => {
      timestamp = state.context.expiresAt;
    },
    secret: 'session-secret',
    before: state.repository.record,
  };
});
