import { withHistoryLock } from '../../historyLock';
import { guestLessonPrefix } from '../../learningStorage';
import { type BrowserStorage, canPersistGuestProgress } from '../../progress/guest';
import { registerGuestLearningMemory } from '../../progress/guestMemoryLifecycle';
import type { DeliveryUnitAsset } from '../delivery/artifactTypes';
import { initialGuestLesson } from './guestInitial';
import { readGuestLessonSource } from './guestSourceCodec';
import type { GuestLessonSource } from './types';

export { guestLessonPrefix } from '../../learningStorage';

type MemoryEntry = { source: GuestLessonSource; base: string | null; pending: boolean };

export class GuestLessonConflictError extends Error {
  constructor() {
    super('Saved and temporary lesson progress differ. Choose which record to keep.');
    this.name = 'GuestLessonConflictError';
  }
}

export class GuestLessonStorage {
  private epoch = 0;
  private readonly memory = new Map<string, MemoryEntry>();
  private readonly listeners = new Set<() => void>();
  private readonly unregister: () => void;
  constructor(
    private readonly storage: BrowserStorage,
    private readonly isCurrent: () => boolean,
  ) {
    this.unregister = registerGuestLearningMemory(() => this.clearMemory());
  }

  private current() {
    if (!this.isCurrent()) throw new Error('Lesson progress owner changed.');
  }

  private key(asset: DeliveryUnitAsset) {
    return `${guestLessonPrefix}${asset.unit.id}.${asset.contentVersion}`;
  }

  private parse(raw: string | null, asset: DeliveryUnitAsset) {
    return raw === null ? initialGuestLesson(asset) : readGuestLessonSource(JSON.parse(raw), asset);
  }

  private load(asset: DeliveryUnitAsset): GuestLessonSource {
    this.current();
    const key = this.key(asset);
    const entry = this.memory.get(key);
    if (!canPersistGuestProgress(this.storage)) {
      if (entry) return structuredClone(entry.source);
      const source = initialGuestLesson(asset);
      this.memory.set(key, { source, base: null, pending: false });
      return structuredClone(source);
    }
    const raw = this.storage.getItem(key);
    if (entry?.pending) {
      const serialized = JSON.stringify(entry.source);
      if (raw !== null && raw !== entry.base && raw !== serialized) {
        throw new GuestLessonConflictError();
      }
      this.parse(raw, asset);
      this.storage.setItem(key, serialized);
      if (this.storage.getItem(key) !== serialized) throw new Error('Lesson save was not confirmed.');
      this.memory.set(key, { ...entry, base: serialized, pending: false });
      return structuredClone(entry.source);
    }
    const source = this.parse(raw, asset);
    this.memory.set(key, { source, base: raw, pending: false });
    return structuredClone(source);
  }

  read(asset: DeliveryUnitAsset) {
    return withHistoryLock(() => this.load(asset));
  }

  hasSource(unitId: string, contentVersion: string) {
    this.current();
    const key = `${guestLessonPrefix}${unitId}.${contentVersion}`;
    return (
      this.memory.has(key) ||
      (canPersistGuestProgress(this.storage) && this.storage.getItem(key) !== null)
    );
  }

  change(asset: DeliveryUnitAsset, update: (source: GuestLessonSource) => GuestLessonSource) {
    const epoch = this.epoch;
    return withHistoryLock(() => {
      if (epoch !== this.epoch) throw new Error('Guest lesson data was reset.');
      const source = this.load(asset);
      const next = readGuestLessonSource(update(source), asset);
      this.current();
      const key = this.key(asset);
      const previous = this.memory.get(key);
      const serialized = JSON.stringify(next);
      if (canPersistGuestProgress(this.storage)) {
        // ロック中に読み直した同一原本だけを書き換え、別タブの進捗を上書きしない。
        if (this.storage.getItem(key) !== previous?.base) throw new GuestLessonConflictError();
        this.storage.setItem(key, serialized);
        if (this.storage.getItem(key) !== serialized) throw new Error('Lesson save was not confirmed.');
        this.memory.set(key, { source: next, base: serialized, pending: false });
      } else {
        this.memory.set(key, { source: next, base: previous?.base ?? null, pending: true });
      }
      return structuredClone(next);
    });
  }

  resolve(asset: DeliveryUnitAsset, choice: 'pending' | 'stored') {
    const epoch = this.epoch;
    return withHistoryLock(() => {
      if (epoch !== this.epoch) throw new Error('Guest lesson data was reset.');
      this.current();
      if (!canPersistGuestProgress(this.storage)) throw new Error('Guest storage consent is required.');
      const key = this.key(asset);
      const pending = this.memory.get(key);
      if (!pending?.pending) throw new Error('No temporary lesson progress exists.');
      const raw = this.storage.getItem(key);
      this.parse(raw, asset);
      if (choice === 'stored') {
        this.memory.delete(key);
      } else {
        const serialized = JSON.stringify(pending.source);
        this.storage.setItem(key, serialized);
        if (this.storage.getItem(key) !== serialized) throw new Error('Lesson save was not confirmed.');
        this.memory.set(key, { ...pending, base: serialized, pending: false });
      }
      return this.load(asset);
    });
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  clearMemory(key?: string) {
    this.epoch++;
    if (key) this.memory.delete(key);
    else this.memory.clear();
    for (const listener of this.listeners) listener();
  }

  dispose() {
    this.unregister();
    this.memory.clear();
    this.listeners.clear();
  }
}
