import {
  EncryptedPkceStorage,
  type RuntimeKeyring,
  type RuntimeRecord,
  type RuntimeRepository,
} from '../supabase/functions/account-linking/runtime/pkce-storage.ts';
import type {
  RuntimeContext,
  RuntimeWriteGuard,
} from '../supabase/functions/account-linking/runtime/types.ts';

export const now = 1_800_000_000_000;
export const intentId = '11111111-1111-4111-8111-111111111111';
export const legId = '22222222-2222-4222-8222-222222222222';
export const storageKey = `kaq-proof:${intentId}:${legId}:1`;

export class MemoryRepository implements RuntimeRepository {
  record: RuntimeRecord | null = null;
  terminal = false;
  failure: Error | null = null;
  onCompare: (() => Promise<void>) | null = null;

  async read(): Promise<RuntimeRecord | null> {
    if (this.failure) throw this.failure;
    return this.record;
  }

  async readRevisionForCleanup(): Promise<number | null> {
    if (this.failure) throw this.failure;
    return this.record?.revision ?? null;
  }

  async compareAndSwap(_: string, revision: number | null, next: RuntimeRecord): Promise<boolean> {
    await this.onCompare?.();
    if (this.terminal || (this.record?.revision ?? null) !== revision) return false;
    this.record = next;
    return true;
  }

  async deleteIfRevision(
    _: string,
    revision: number | null,
    _guard: RuntimeWriteGuard,
  ): Promise<'deleted' | 'missing' | 'conflict'> {
    if ((this.record?.revision ?? null) !== revision) return 'conflict';
    if (!this.record) return 'missing';
    this.record = null;
    return 'deleted';
  }

  async isTerminal(): Promise<boolean> {
    return this.terminal;
  }
}

export function context(overrides: Partial<RuntimeContext> = {}): RuntimeContext {
  const attempt = overrides.attempt ?? 1;
  return {
    purpose: 'leg',
    intentId,
    legId,
    attempt,
    storageKey: `kaq-proof:${intentId}:${legId}:${attempt}`,
    issuedAt: now,
    expiresAt: now + 180_000,
    ...overrides,
  };
}

export function keyring(version = 'v1', fill = 0): RuntimeKeyring {
  return {
    active: async () => ({ version, bytes: new Uint8Array(32).fill(fill) }),
    resolve: async (candidate) => (candidate === version ? new Uint8Array(32).fill(fill) : null),
  };
}

export function storage(
  repository: RuntimeRepository,
  options: { now?: () => number; keyring?: RuntimeKeyring; context?: RuntimeContext } = {},
): EncryptedPkceStorage {
  return new EncryptedPkceStorage({
    repository,
    crypto: globalThis.crypto,
    clock: { now: options.now ?? (() => now) },
    keyring: options.keyring ?? keyring(),
    context: options.context ?? context(),
  });
}
