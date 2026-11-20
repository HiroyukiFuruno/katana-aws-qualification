import type { Attempt } from '../attempts';
import type { MemberProgressOwner } from './types';

export type PendingEvent = { attempt: Attempt; certificationId: string; eventId: string };
export type RetryStorage = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>;
type StoredQueue = { version: 1; generation: number; events: PendingEvent[] };
type LockNavigator = { locks?: { request<T>(name: string, action: () => Promise<T>): Promise<T> } };

export class OutboxGenerationAheadError extends Error {
  constructor() {
    super('Learning outbox is newer than the server generation.');
  }
}

export function withOutboxLock<T>(key: string, action: () => Promise<T>) {
  const locks = (globalThis as typeof globalThis & { navigator?: LockNavigator }).navigator?.locks;
  return locks ? locks.request(`katana.learning-outbox.${key}`, action) : action();
}

function validAttempt(value: unknown): value is Attempt {
  if (!value || typeof value !== 'object') return false;
  const attempt = value as Partial<Attempt>;
  return (
    attempt.schemaVersion === 1 &&
    typeof attempt.questionId === 'string' &&
    Number.isSafeInteger(attempt.questionRevision) &&
    Array.isArray(attempt.selected) &&
    Array.isArray(attempt.correct) &&
    typeof attempt.answeredAt === 'string' &&
    typeof attempt.mode === 'string'
  );
}

export function retryStorageKey(owner: MemberProgressOwner) {
  return `katana.learning-outbox.v1.${encodeURIComponent(owner.userId)}`;
}

export function restoreOutbox(storage: RetryStorage, key: string, generation: number) {
  const raw = storage.getItem(key);
  if (raw === null) return [];
  let stored: StoredQueue;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || (value as { version?: unknown }).version !== 1)
      throw new Error('Invalid learning outbox.');
    stored = value as StoredQueue;
    if (
      !Number.isSafeInteger(stored.generation) ||
      stored.generation < 0 ||
      !Array.isArray(stored.events) ||
      stored.events.some(
        (event) =>
          !event ||
          typeof event !== 'object' ||
          typeof event.eventId !== 'string' ||
          typeof event.certificationId !== 'string' ||
          !validAttempt(event.attempt),
      )
    )
      throw new Error('Invalid learning outbox.');
  } catch {
    throw new Error('学習履歴の未同期データを読み込めませんでした。');
  }
  if (stored.generation < generation) {
    storage.removeItem(key);
    return [];
  }
  if (stored.generation > generation) throw new OutboxGenerationAheadError();
  return stored.events;
}

export function persistOutbox(
  storage: RetryStorage,
  key: string,
  generation: number | undefined,
  events: Iterable<PendingEvent>,
  removeEventIds: Iterable<string> = [],
) {
  if (generation === undefined) throw new Error('Learning generation is not initialized.');
  const removeIds = new Set(removeEventIds);
  const existing = storage.getItem(key);
  let merged: PendingEvent[] = [];
  if (existing !== null) {
    const value: unknown = JSON.parse(existing);
    if (
      !value ||
      typeof value !== 'object' ||
      (value as { version?: unknown }).version !== 1 ||
      (value as { generation?: unknown }).generation !== generation ||
      !Array.isArray((value as { events?: unknown }).events)
    ) {
      throw new Error('学習履歴の未同期データを読み込めませんでした。');
    }
    merged = (value as StoredQueue).events;
  }
  const byId = new Map(merged.map((event) => [event.eventId, event]));
  for (const event of events) byId.set(event.eventId, event);
  for (const eventId of removeIds) byId.delete(eventId);
  const pending = [...byId.values()];
  if (!pending.length) return storage.removeItem(key);
  storage.setItem(key, JSON.stringify({ version: 1, generation, events: pending }));
}
