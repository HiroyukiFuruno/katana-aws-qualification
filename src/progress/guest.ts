import { historyKey } from '../learningStorage';
import { parseStoredAttempts } from './attemptCodec';
import { isGuestExamDraft } from './guestExamCodec';
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
  read(key: string): string | null;
  remove(key: string): void;
  removeMatching(prefix: string): void;
  write(key: string, value: string): 'saved' | 'blocked' | 'failed';
};

export function createGuestProgressRepository(
  owner: GuestProgressOwner,
  storage: BrowserStorage,
  operation: ProgressOperation,
): GuestProgressRepository {
  const memory = new Map<string, string>();
  const current = () => assertCurrentProgressOwner(operation);
  const profile = (value: unknown) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const candidate = value as { earned?: unknown; answers?: unknown };
    return (
      Array.isArray(candidate.earned) &&
      candidate.earned.every((item) => typeof item === 'string') &&
      candidate.answers !== null &&
      typeof candidate.answers === 'object' &&
      !Array.isArray(candidate.answers) &&
      Object.values(candidate.answers).every((item) => typeof item === 'number')
    );
  };
  const merged = (key: string, disk: string | null, pending: string): string | undefined => {
    if (disk === null || disk === pending) return pending;
    try {
      const diskRows: unknown = JSON.parse(disk);
      const pendingRows: unknown = JSON.parse(pending);
      if (profile(diskRows) && profile(pendingRows)) return pending;
      if (isGuestExamDraft(diskRows) && isGuestExamDraft(pendingRows)) return pending;
      if (!Array.isArray(diskRows) || !Array.isArray(pendingRows)) return undefined;
      if (key === historyKey && parseStoredAttempts(disk).corruptRows > 0) return undefined;
      const prefix = JSON.stringify(pendingRows.slice(0, diskRows.length)) === JSON.stringify(diskRows);
      return JSON.stringify(prefix ? pendingRows : [...diskRows, ...pendingRows]);
    } catch {
      return undefined;
    }
  };
  return {
    owner,
    read(key) {
      current();
      if (canPersistGuestProgress(storage)) return memory.get(key) ?? storage.getItem(key);
      return memory.get(key) ?? null;
    },
    remove(key) {
      current();
      memory.delete(key);
      if (canPersistGuestProgress(storage)) storage.removeItem(key);
    },
    removeMatching(prefix) {
      current();
      for (const key of memory.keys()) {
        if (key.startsWith(prefix)) memory.delete(key);
      }
      if (!canPersistGuestProgress(storage) || !storage.key || storage.length === undefined) return;
      const keys = Array.from({ length: storage.length }, (_, index) => storage.key?.(index)).filter(
        (key): key is string => key?.startsWith(prefix) ?? false,
      );
      for (const key of keys) storage.removeItem(key);
    },
    write(key, value) {
      current();
      if (!canPersistGuestProgress(storage)) {
        memory.set(key, value);
        return 'blocked';
      }
      const pending = value;
      const disk = storage.getItem(key);
      const valueToPersist = merged(key, disk, pending);
      if (valueToPersist === undefined) return 'failed';
      const result = writeGuestProgress(storage, key, valueToPersist);
      if (result === 'saved') {
        memory.delete(key);
      }
      return result;
    },
  };
}
