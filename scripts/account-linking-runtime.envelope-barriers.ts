import { promoteEnvelope } from '../supabase/functions/account-linking/runtime/crypto.ts';
import {
  EncryptedPkceStorage,
  RuntimeStorageError,
  type RuntimeRecord,
} from '../supabase/functions/account-linking/runtime/pkce-storage.ts';
import type { RuntimeContext } from '../supabase/functions/account-linking/runtime/types.ts';
import { context, keyring, MemoryRepository, now, storage } from './account-linking-runtime-fixture.ts';

export const nonce = 'ab'.repeat(32);

export type Gate = { entered: Promise<void>; pause(): Promise<void>; release(): void };

export function gate(): Gate {
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  return {
    entered: entered.promise,
    pause: async () => {
      entered.resolve();
      await release.promise;
    },
    release: release.resolve,
  };
}

export async function nonceHash(value = nonce): Promise<Uint8Array> {
  const pairs = value.match(/.{2}/g);
  if (!pairs) throw new Error('invalid nonce fixture');
  const raw = Uint8Array.from(pairs.map((pair) => Number.parseInt(pair, 16)));
  return new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', raw));
}

export class BarrierRepository extends MemoryRepository {
  readBarrier: Gate | null = null;
  casBarrier: Gate | null = null;
  readonly events: string[] = [];
  readonly writes: RuntimeRecord[] = [];

  override async read(): Promise<RuntimeRecord | null> {
    this.events.push('read');
    await this.readBarrier?.pause();
    return super.read();
  }

  override async compareAndSwap(
    _legId: string,
    revision: number | null,
    next: RuntimeRecord,
  ): Promise<boolean> {
    this.events.push('cas');
    await this.casBarrier?.pause();
    if ((this.record?.revision ?? null) !== revision) return false;
    this.writes.push(next);
    this.record = next;
    return true;
  }

  override async deleteIfRevision(...args: Parameters<MemoryRepository['deleteIfRevision']>) {
    this.events.push('delete');
    return super.deleteIfRevision(...args);
  }
}

export function cryptoBarrier(method: 'decrypt' | 'digest', barrier: Gate): Crypto {
  const subtle = new Proxy(globalThis.crypto.subtle, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (property === method)
        return async (...args: never[]) => {
          await barrier.pause();
          return Reflect.apply(value, target, args);
        };
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  return new Proxy(globalThis.crypto, {
    get(target, property, receiver) {
      if (property === 'subtle') return subtle;
      const value = Reflect.get(target, property, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as Crypto;
}

export function storageWithCrypto(
  repository: MemoryRepository,
  crypto: Crypto,
  runtimeContext = context(),
  clock: () => number = () => now,
): EncryptedPkceStorage {
  return new EncryptedPkceStorage({
    repository,
    crypto,
    clock: { now: clock },
    keyring: keyring('v1', 7),
    context: runtimeContext,
  });
}

export async function proofClient(repository: MemoryRepository): Promise<{
  expected: Uint8Array;
  client: ReturnType<typeof storage>;
  context: RuntimeContext;
}> {
  const expected = await nonceHash();
  const leg = storage(repository, { keyring: keyring('v1', 7) });
  await leg.initialize(nonce, expected);
  const record = repository.record;
  if (!record) throw new Error('missing nonce record');
  const proof = context({ purpose: 'proof', expiresAt: context().issuedAt + 600_000 });
  repository.record = await promoteEnvelope(
    globalThis.crypto,
    context(),
    proof,
    record,
    new Uint8Array(32).fill(7),
    1,
    'v1',
    new Uint8Array(32).fill(7),
  );
  return {
    expected,
    context: proof,
    client: storage(repository, { context: proof, keyring: keyring('v1', 7) }),
  };
}

export async function fixedFailure(value: Promise<unknown>): Promise<RuntimeStorageError> {
  try {
    await value;
  } catch (error) {
    if (error instanceof RuntimeStorageError) return error;
    throw error;
  }
  throw new Error('expected runtime failure');
}
