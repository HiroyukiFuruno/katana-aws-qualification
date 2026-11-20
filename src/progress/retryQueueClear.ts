import { type PendingEvent, type RetryStorage, withOutboxLock } from './retryOutboxStorage';
import { persistPending } from './retryQueuePersistence';

export async function clearPendingEvents(
  storage: RetryStorage,
  storageKey: string,
  generation: number | undefined,
  pending: Map<string, PendingEvent>,
) {
  const previous = new Map(pending);
  pending.clear();
  if (generation === undefined) {
    await withOutboxLock(storageKey, async () => storage.removeItem(storageKey));
    return;
  }
  try {
    await persistPending(
      storage,
      storageKey,
      generation,
      pending,
      [...previous.values()].map((event) => event.eventId),
    );
  } catch (error) {
    for (const [eventId, value] of previous) pending.set(eventId, value);
    throw error;
  }
}
