import { RuntimeBoundary } from './boundary.ts';
import { fixedContext, writeGuard } from './context.ts';
import { decryptSlots, encryptSlots } from './crypto.ts';
import { RuntimeMutationQueue } from './serial.ts';
import { allowedKey, failure, type Slots, sanitize } from './slots.ts';
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
      this.validateKey(key);
      return (await this.readSlots()).slots[key] ?? null;
    });
  }

  async setItem(key: string, value: string): Promise<void> {
    return this.mutations.run(() =>
      this.boundary.run(async () => {
        this.validateKey(key);
        const current = await this.readSlots();
        await this.write(current.record, {
          ...current.slots,
          [key]: sanitize(key, this.context.storageKey, value),
        });
      }),
    );
  }

  async removeItem(key: string): Promise<void> {
    return this.mutations.run(() =>
      this.boundary.run(async () => {
        this.validateKey(key);
        const current = await this.readSlots();
        if (!(key in current.slots)) return;
        const { [key]: _, ...slots } = current.slots;
        await this.write(current.record, slots);
      }),
    );
  }

  async terminate(): Promise<void> {
    return this.mutations.run(() =>
      this.boundary.run(async () => {
        const revision = await this.boundary.dependency(() =>
          this.options.repository.readRevisionForCleanup(this.context.legId, writeGuard(this.context)),
        );
        const result = await this.boundary.dependency(() =>
          this.options.repository.deleteIfRevision(
            this.context.legId,
            revision,
            writeGuard(this.context),
          ),
        );
        if (result === 'conflict') throw failure('cas_conflict');
        this.terminated = true;
      }),
    );
  }

  private validateKey(key: string): void {
    if (!allowedKey(this.context, key)) throw failure('invalid_storage_key');
  }

  private async live(): Promise<void> {
    const first = this.boundary.now();
    if (this.terminated || first >= this.context.expiresAt)
      throw failure(this.terminated ? 'terminal' : 'expired');
    if (await this.boundary.dependency(() => this.options.repository.isTerminal(this.context.legId)))
      throw failure('terminal');
    const second = this.boundary.now();
    if (this.terminated || second >= this.context.expiresAt)
      throw failure(this.terminated ? 'terminal' : 'expired');
  }

  private async readSlots(): Promise<{ record: RuntimeRecord | null; slots: Slots }> {
    await this.live();
    const record = await this.boundary.dependency(() =>
      this.options.repository.read(this.context.legId),
    );
    await this.live();
    if (!record) return { record: null, slots: {} };
    if (record.expiresAt !== this.context.expiresAt) throw failure('invalid_context');
    const material = await this.boundary.dependency(() =>
      this.options.keyring.resolve(record.keyVersion),
    );
    await this.live();
    if (!material) throw failure('unknown_key');
    const slots = await decryptSlots(this.options.crypto, this.context, record, material);
    await this.live();
    return { record, slots };
  }

  private async write(current: RuntimeRecord | null, slots: Slots): Promise<void> {
    await this.live();
    const active = await this.boundary.dependency(() => this.options.keyring.active());
    await this.live();
    const next = await encryptSlots(
      this.options.crypto,
      this.context,
      (current?.revision ?? -1) + 1,
      active.version,
      active.bytes,
      slots,
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
