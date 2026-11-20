import { historyKey } from '../learningStorage';
import { isGuestExamDraft } from './guestExamCodec';
import type { GuestHistoryMemory } from './guestHistoryMemory';

type StorageLike = Pick<Storage, 'getItem'>;
type Write = (key: string, value: string) => 'blocked' | 'failed' | 'saved';
export type GuestStorageConflict = { key: string; kind: 'exam' | 'profile' };

function profile(value: unknown) {
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
}

function parse(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

export function mergeGuestValue(disk: string | null, pending: string): string | undefined {
  if (disk === null || disk === pending) return pending;
  const diskRows = parse(disk);
  const pendingRows = parse(pending);
  if (diskRows === undefined || pendingRows === undefined) return undefined;
  if (profile(diskRows) && profile(pendingRows)) return pending;
  if (isGuestExamDraft(diskRows) && isGuestExamDraft(pendingRows)) return pending;
  if (!Array.isArray(diskRows) || !Array.isArray(pendingRows)) return undefined;
  const prefix = JSON.stringify(pendingRows.slice(0, diskRows.length)) === JSON.stringify(diskRows);
  return JSON.stringify(prefix ? pendingRows : [...diskRows, ...pendingRows]);
}

export function clearMatchingMemory(memory: Map<string, string>, prefix: string) {
  for (const key of memory.keys()) {
    if (key.startsWith(prefix)) memory.delete(key);
  }
}

function conflict(disk: string | null, pending: string): GuestStorageConflict['kind'] | undefined {
  if (disk === null || disk === pending) return undefined;
  const diskValue = parse(disk);
  const pendingValue = parse(pending);
  if (diskValue === undefined || pendingValue === undefined) return undefined;
  if (profile(diskValue) && profile(pendingValue)) return 'profile';
  if (isGuestExamDraft(diskValue) && isGuestExamDraft(pendingValue)) return 'exam';
  return undefined;
}

export function guestStorageConflicts(storage: StorageLike, memory: Map<string, string>) {
  return [...memory].flatMap(([key, value]) => {
    const kind = conflict(storage.getItem(key), value);
    return kind === undefined ? [] : [{ key, kind }];
  });
}

export function resolveGuestStorageConflict(
  storage: StorageLike,
  memory: Map<string, string>,
  key: string,
  choice: 'pending' | 'stored',
  write: Write,
) {
  const pending = memory.get(key);
  if (pending === undefined || conflict(storage.getItem(key), pending) === undefined) return 'failed';
  if (choice === 'stored') {
    memory.delete(key);
    return 'saved';
  }
  if (write(key, pending) !== 'saved') return 'failed';
  memory.delete(key);
  return 'saved';
}

export function flushGuestMemory(
  storage: StorageLike,
  memory: Map<string, string>,
  history: GuestHistoryMemory,
  write: Write,
) {
  if (!history.hasPending() && memory.size === 0) return 'saved';
  try {
    const historyResult = history.flush(storage.getItem(historyKey), (value) =>
      write(historyKey, value),
    );
    if (historyResult !== 'saved') return historyResult;
    if (guestStorageConflicts(storage, memory).length) return 'conflict';
    for (const [key, value] of memory) {
      const merged = mergeGuestValue(storage.getItem(key), value);
      if (merged === undefined) return 'failed';
      const result = write(key, merged);
      if (result !== 'saved') return result;
      memory.delete(key);
    }
    return 'saved';
  } catch {
    return 'failed';
  }
}

export function createGuestPendingOperations(
  storage: StorageLike,
  memory: Map<string, string>,
  history: GuestHistoryMemory,
  current: () => void,
  canPersist: () => boolean,
  write: Write,
) {
  const persisted = <T>(operation: () => T): T | 'blocked' => {
    current();
    return canPersist() ? operation() : 'blocked';
  };
  return {
    conflicts: () => {
      current();
      return canPersist() ? guestStorageConflicts(storage, memory) : [];
    },
    flush: () => persisted(() => flushGuestMemory(storage, memory, history, write)),
    hasPending: () => history.hasPending() || memory.size > 0,
    resolve: (key: string, choice: 'pending' | 'stored') =>
      persisted(() => resolveGuestStorageConflict(storage, memory, key, choice, write)),
  };
}
