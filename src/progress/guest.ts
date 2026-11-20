import { historyKey } from '../learningStorage';
import { GuestHistoryMemory } from './guestHistoryMemory';
import {
  clearMatchingMemory,
  createGuestPendingOperations,
  type GuestStorageConflict,
  mergeGuestValue,
} from './guestPendingMemory';
import type { GuestProgressOwner, ProgressOperation } from './types';
import { assertCurrentProgressOwner } from './types';

export const guestProgressConsentKey = 'katana.learning-progress-consent.v1';

export type BrowserStorage = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'> &
  Partial<Pick<Storage, 'key' | 'length'>>;

export function canPersistGuestProgress(storage: BrowserStorage) {
  try {
    return storage.getItem(guestProgressConsentKey) === 'granted';
  } catch {
    return false;
  }
}

export function setGuestProgressConsent(storage: BrowserStorage, granted: boolean) {
  try {
    if (granted) storage.setItem(guestProgressConsentKey, 'granted');
    else storage.removeItem(guestProgressConsentKey);
    return true;
  } catch {
    return false;
  }
}

export function writeGuestProgress(
  storage: BrowserStorage,
  key: string,
  value: string,
): 'saved' | 'blocked' | 'failed' {
  if (!canPersistGuestProgress(storage)) return 'blocked';
  try {
    storage.setItem(key, value);
    return 'saved';
  } catch {
    return 'failed';
  }
}

export type GuestProgressRepository = {
  readonly owner: GuestProgressOwner;
  flushPending(): 'blocked' | 'conflict' | 'failed' | 'saved';
  hasPending(): boolean;
  read(key: string): string | null;
  resolveStorageConflict(key: string, choice: 'pending' | 'stored'): 'blocked' | 'failed' | 'saved';
  remove(key: string): void;
  removeMatching(prefix: string): void;
  purge(key: string): void;
  purgeMatching(prefix: string): void;
  storageConflicts(): readonly GuestStorageConflict[];
  write(key: string, value: string): 'saved' | 'blocked' | 'failed';
};

export function createGuestProgressRepository(
  owner: GuestProgressOwner,
  storage: BrowserStorage,
  operation: ProgressOperation,
): GuestProgressRepository {
  const memory = new Map<string, string>();
  const history = new GuestHistoryMemory();
  const current = () => assertCurrentProgressOwner(operation);
  const pending = createGuestPendingOperations(
    storage,
    memory,
    history,
    current,
    () => canPersistGuestProgress(storage),
    (key, value) => writeGuestProgress(storage, key, value),
  );
  return {
    owner,
    flushPending: pending.flush,
    hasPending: pending.hasPending,
    read(key) {
      current();
      const persisted = canPersistGuestProgress(storage);
      if (key === historyKey) return history.read(persisted ? storage.getItem(key) : null, persisted);
      if (persisted) return memory.get(key) ?? storage.getItem(key);
      return memory.get(key) ?? null;
    },
    resolveStorageConflict: pending.resolve,
    remove(key) {
      current();
      if (key === historyKey) history.clear();
      memory.delete(key);
      if (canPersistGuestProgress(storage)) storage.removeItem(key);
    },
    removeMatching(prefix) {
      current();
      if (historyKey.startsWith(prefix)) history.clear();
      clearMatchingMemory(memory, prefix);
      if (!canPersistGuestProgress(storage) || !storage.key || storage.length === undefined) return;
      const keys = Array.from({ length: storage.length }, (_, index) => storage.key?.(index)).filter(
        (key): key is string => key?.startsWith(prefix) ?? false,
      );
      for (const key of keys) storage.removeItem(key);
    },
    purge(key) {
      current();
      if (key === historyKey) history.clear();
      memory.delete(key);
      storage.removeItem(key);
    },
    purgeMatching(prefix) {
      current();
      if (historyKey.startsWith(prefix)) history.clear();
      clearMatchingMemory(memory, prefix);
      if (!storage.key || storage.length === undefined) return;
      const keys = Array.from({ length: storage.length }, (_, index) => storage.key?.(index)).filter(
        (key): key is string => key?.startsWith(prefix) ?? false,
      );
      for (const key of keys) storage.removeItem(key);
    },
    storageConflicts: pending.conflicts,
    write(key, value) {
      current();
      if (!canPersistGuestProgress(storage)) {
        if (key === historyKey) {
          history.remember(value);
          return 'blocked';
        }
        memory.set(key, value);
        return 'blocked';
      }
      if (key === historyKey) {
        return history.save(storage.getItem(key), value, (pending) =>
          writeGuestProgress(storage, key, pending),
        );
      }
      if (pending.conflicts().some((conflict) => conflict.key === key)) {
        return 'failed';
      }
      const valueToPersist = mergeGuestValue(storage.getItem(key), value);
      if (valueToPersist === undefined) return 'failed';
      const result = writeGuestProgress(storage, key, valueToPersist);
      if (result === 'saved') memory.delete(key);
      return result;
    },
  };
}
