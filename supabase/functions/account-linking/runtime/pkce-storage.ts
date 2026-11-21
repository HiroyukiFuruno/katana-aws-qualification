import { RuntimeBoundary } from './boundary.ts';
import { fixedContext, writeGuard } from './context.ts';
import { decryptEnvelope, encryptEnvelope } from './crypto.ts';
import { ensureLive } from './liveness.ts';
import * as EnvelopeNonce from './nonce.ts';
import { copyHash, matchHash, type NonceAccess } from './nonce.ts';
import { RuntimeMutationQueue } from './serial.ts';
import { type Envelope, failure, sanitize, validateKey } from './slots.ts';
import { terminateRuntime } from './termination.ts';
import type { RuntimeContext, RuntimeRecord, RuntimeStorageOptions } from './types.ts';

export {
  type RuntimeKeyring,
  type RuntimeRecord,
  type RuntimeRepository,
  RuntimeStorageError,
} from './types.ts';

export class EncryptedPkceStorage {
  private terminated = false;
  private readonly context: RuntimeContext;
  private readonly boundary: RuntimeBoundary;
  private readonly mutations = new RuntimeMutationQueue();

  constructor(private readonly options: RuntimeStorageOptions) {
    this.context = fixedContext(options.context);
    this.boundary = new RuntimeBoundary(options.clock);
  }

  async getItem(key: string): Promise<string | null> {
    return this.boundary.run(async () => {
      validateKey(this.context, key);
      return (await this.readEnvelope()).envelope.slots[key] ?? null;
    });
  }

  async setItem(key: string, value: string): Promise<void> {
    return this.mutations.run(() =>
      this.boundary.run(async () => {
        validateKey(this.context, key);
        const current = await this.readEnvelope();
        await this.write(current.record, {
          ...current.envelope,
          slots: { ...current.envelope.slots, [key]: sanitize(key, this.context.storageKey, value) },
        });
      }),
    );
  }

  async removeItem(key: string): Promise<void> {
    return this.mutations.run(() =>
      this.boundary.run(async () => {
        validateKey(this.context, key);
        const current = await this.readEnvelope();
        if (!(key in current.envelope.slots)) return;
        const { [key]: _, ...slots } = current.envelope.slots;
        await this.write(current.record, { ...current.envelope, slots });
      }),
    );
  }

  async terminate(): Promise<void> {
    const result = await terminateRuntime({
      legId: this.context.legId,
      guard: writeGuard(this.context),
      repository: this.options.repository,
      complete: () => {
        this.terminated = true;
      },
      run: (operation) => this.boundary.run(async () => this.boundary.dependency(operation)),
      mutate: (operation) => this.mutations.run(operation),
    });
    if (result === 'conflict') throw failure('cas_conflict');
  }

  async initialize(ingestNonce: string, expectedHash: Uint8Array): Promise<void> {
    return EnvelopeNonce.initialize(this.nonceAccess(), ingestNonce, copyHash(expectedHash));
  }

  async getIngestNonce(expectedHash: Uint8Array): Promise<string> {
    return EnvelopeNonce.get(this.nonceAccess(), copyHash(expectedHash));
  }

  async clearIngestNonce(expectedHash: Uint8Array): Promise<void> {
    return EnvelopeNonce.clear(this.nonceAccess(), copyHash(expectedHash));
  }

  private nonceAccess(): NonceAccess {
    return {
      context: this.context,
      run: (operation) => this.boundary.run(operation),
      mutate: (operation) => this.mutations.run(operation),
      read: () => this.readEnvelope(),
      write: (record, envelope) => this.write(record, envelope),
      matches: (nonce, expected) => matchHash(this.options.crypto, () => this.live(), nonce, expected),
    };
  }

  private async live(): Promise<void> {
    const now = () => this.boundary.now();
    return ensureLive(now, this.context, () => this.terminated, this.options.repository);
  }

  private async readEnvelope(): Promise<{ record: RuntimeRecord | null; envelope: Envelope }> {
    await this.live();
    const record = await this.boundary.dependency(() =>
      this.options.repository.read(this.context.legId),
    );
    await this.live();
    if (!record) return { record: null, envelope: { slots: {} } };
    if (record.expiresAt !== this.context.expiresAt) throw failure('invalid_context');
    const material = await this.boundary.dependency(() =>
      this.options.keyring.resolve(record.keyVersion),
    );
    await this.live();
    if (!material) throw failure('unknown_key');
    const envelope = await decryptEnvelope(this.options.crypto, this.context, record, material);
    await this.live();
    return { record, envelope };
  }

  private async write(current: RuntimeRecord | null, envelope: Envelope): Promise<void> {
    await this.live();
    const active = await this.boundary.dependency(() => this.options.keyring.active());
    await this.live();
    const next = await encryptEnvelope(
      this.options.crypto,
      this.context,
      (current?.revision ?? -1) + 1,
      active.version,
      active.bytes,
      envelope,
    );
    await this.live();
    if (
      !(await this.boundary.dependency(() =>
        this.options.repository.compareAndSwap(
          this.context.legId,
          current?.revision ?? null,
          next,
          writeGuard(this.context),
        ),
      ))
    )
      throw failure('cas_conflict');
    await this.live();
  }
}
