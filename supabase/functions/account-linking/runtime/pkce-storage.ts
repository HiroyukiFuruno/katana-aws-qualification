import type { RuntimeContext, RuntimeRecord, RuntimeStorageOptions } from './types.ts';
import { decryptSlots, encryptSlots } from './crypto.ts';
import { checkedNow, fixedContext, writeGuard } from './context.ts';
import { allowedKey, failure, isLocalFailure, sanitize, type Slots } from './slots.ts';

export {
  RuntimeStorageError,
  type RuntimeKeyring,
  type RuntimeRecord,
  type RuntimeRepository,
} from './types.ts';

export class EncryptedPkceStorage {
  private terminated = false;
  private readonly context: RuntimeContext;

  constructor(private readonly options: RuntimeStorageOptions) {
    this.context = fixedContext(options.context);
  }

  async getItem(key: string): Promise<string | null> {
    return this.safe(async () => {
      this.validateKey(key);
      return (await this.readSlots()).slots[key] ?? null;
    });
  }

  async setItem(key: string, value: string): Promise<void> {
    return this.safe(async () => {
      this.validateKey(key);
      const current = await this.readSlots();
      const slots = { ...current.slots, [key]: sanitize(key, this.context.storageKey, value) };
      await this.write(current.record, slots);
    });
  }

  async removeItem(key: string): Promise<void> {
    return this.safe(async () => {
      this.validateKey(key);
      const current = await this.readSlots();
      if (!(key in current.slots)) return;
      const { [key]: _, ...slots } = current.slots;
      await this.write(current.record, slots);
    });
  }

  async terminate(): Promise<void> {
    return this.safe(async () => {
      const record = await this.dependency(() => this.options.repository.read(this.context.legId));
      const result = await this.dependency(() =>
        this.options.repository.deleteIfRevision(
          this.context.legId,
          record?.revision ?? null,
          writeGuard(this.context),
        ),
      );
      if (result === 'conflict') throw failure('cas_conflict');
      this.terminated = true;
    });
  }

  private async safe<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (isLocalFailure(error)) throw error;
      throw failure('repository_failed');
    }
  }

  private async dependency<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch {
      throw failure('repository_failed');
    }
  }

  private now(): number {
    let value: number;
    try {
      value = this.options.clock.now();
    } catch {
      throw failure('repository_failed');
    }
    return checkedNow(value);
  }

  private validateKey(key: string): void {
    if (!allowedKey(this.context, key)) throw failure('invalid_storage_key');
  }

  private async live(): Promise<void> {
    const first = this.now();
    if (this.terminated || first >= this.context.expiresAt)
      throw failure(this.terminated ? 'terminal' : 'expired');
    if (await this.dependency(() => this.options.repository.isTerminal(this.context.legId)))
      throw failure('terminal');
    const second = this.now();
    if (this.terminated || second >= this.context.expiresAt)
      throw failure(this.terminated ? 'terminal' : 'expired');
  }

  private async readSlots(): Promise<{ record: RuntimeRecord | null; slots: Slots }> {
    await this.live();
    const record = await this.dependency(() => this.options.repository.read(this.context.legId));
    await this.live();
    if (!record) return { record: null, slots: {} };
    if (record.expiresAt !== this.context.expiresAt) throw failure('invalid_context');
    const material = await this.dependency(() => this.options.keyring.resolve(record.keyVersion));
    await this.live();
    if (!material) throw failure('unknown_key');
    const slots = await decryptSlots(this.options.crypto, this.context, record, material);
    await this.live();
    return { record, slots };
  }

  private async write(current: RuntimeRecord | null, slots: Slots): Promise<void> {
    await this.live();
    const active = await this.dependency(() => this.options.keyring.active());
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
      !(await this.dependency(() =>
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
