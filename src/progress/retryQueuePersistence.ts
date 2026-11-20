import {
  type PendingEvent,
  persistOutbox,
  type RetryStorage,
  withOutboxLock,
} from './retryOutboxStorage';

export function persistPending(
  storage: RetryStorage,
  storageKey: string,
  generation: number | undefined,
  pending: Map<string, PendingEvent>,
  removeEventIds: Iterable<string> = [],
) {
  return withOutboxLock(storageKey, async () =>
    persistOutbox(storage, storageKey, generation, pending.values(), removeEventIds),
  );
}

export async function removePendingEvent(
  storage: RetryStorage,
  storageKey: string,
  generation: number | undefined,
  pending: Map<string, PendingEvent>,
  eventId: string,
) {
  const event = pending.get(eventId);
  if (!event) return;
  pending.delete(eventId);
  try {
    await persistPending(storage, storageKey, generation, pending, [eventId]);
  } catch (error) {
    pending.set(eventId, event);
    throw error;
  }
}
