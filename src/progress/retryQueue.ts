import type { Attempt } from '../attempts';
import type { MemberEvent, MemberProgressRepository } from './member';
import {
  type PendingEvent,
  type RetryStorage,
  restoreOutbox,
  retryStorageKey,
  withOutboxLock,
} from './retryOutboxStorage';
import { clearPendingEvents } from './retryQueueClear';
import { pendingFor } from './retryQueueKey';
import { assertCurrentAfterEnqueue } from './retryQueueOwnerGuard';
import { persistPending, removePendingEvent } from './retryQueuePersistence';
import { preparationError, preparedAttempt, type QueuePreparation } from './retryQueuePreparation';
import { flushedEventsFor, withFlushedEvents } from './retryQueueReceipt';
import type { MemberProgressOwner } from './types';

export { eventKey } from './retryQueueKey';

export class MemberRetryQueue {
  readonly owner: MemberProgressOwner;
  readonly pending = new Map<string, PendingEvent>();
  private serverGeneration: number | undefined;
  private readonly storageKey: string;

  constructor(
    owner: MemberProgressOwner,
    private readonly storage: RetryStorage,
  ) {
    this.owner = owner;
    this.storageKey = retryStorageKey(owner);
  }

  async setServerGeneration(generation: number) {
    if (!Number.isSafeInteger(generation) || generation < 0)
      throw new Error('Invalid learning generation.');
    this.serverGeneration = generation;
    this.pending.clear();
    const events = await withOutboxLock(this.storageKey, async () =>
      restoreOutbox(this.storage, this.storageKey, generation),
    );
    const eventIds = new Set<string>();
    for (const event of events) {
      if (eventIds.has(event.eventId)) throw new Error('Duplicate learning outbox entry.');
      this.pending.set(event.eventId, event);
      eventIds.add(event.eventId);
    }
  }

  async enqueue(certificationId: string, attempt: Attempt) {
    const current = pendingFor(this.pending.values(), certificationId, attempt);
    if (current) return current;
    const event = { certificationId, attempt, eventId: crypto.randomUUID() };
    this.pending.set(event.eventId, event);
    try {
      await persistPending(this.storage, this.storageKey, this.serverGeneration, this.pending);
    } catch (error) {
      this.pending.delete(event.eventId);
      throw error;
    }
    return event;
  }

  has(certificationId: string, attempt: Attempt) {
    return pendingFor(this.pending.values(), certificationId, attempt) !== undefined;
  }

  hasPending() {
    return this.pending.size > 0;
  }

  async append(
    repository: MemberProgressRepository,
    certificationId: string,
    attempt: Attempt,
    prepare?: (flushed: PendingEvent[]) => QueuePreparation | Promise<QueuePreparation>,
  ) {
    const retrying = pendingFor(this.pending.values(), certificationId, attempt);
    const flushed = await this.flush(repository);
    if (retrying) return { attempt: retrying.attempt, flushed };
    try {
      const preparation = (await prepare?.(flushed)) ?? attempt;
      repository.assertCurrent();
      const prepared = preparedAttempt(preparation);
      const enqueued = await this.enqueue(certificationId, prepared);
      await assertCurrentAfterEnqueue(repository, () =>
        removePendingEvent(
          this.storage,
          this.storageKey,
          this.serverGeneration,
          this.pending,
          enqueued.eventId,
        ),
      );
      const error = preparationError(preparation);
      if (error !== undefined) throw error;
      return { attempt: prepared, flushed: [...flushed, ...(await this.flush(repository))] };
    } catch (error) {
      throw withFlushedEvents(error, [...flushed, ...flushedEventsFor(error)]);
    }
  }

  async flush(repository: MemberProgressRepository) {
    if (repository.owner !== this.owner) throw new Error('A retry queue cannot change progress owner.');
    const flushed: PendingEvent[] = [];
    for (const [eventId, item] of this.pending) {
      const event: MemberEvent = {
        ...item.attempt,
        certificationId: item.certificationId,
        eventId: item.eventId,
      };
      try {
        await repository.append(event);
      } catch (error) {
        throw withFlushedEvents(error, flushed);
      }
      this.pending.delete(eventId);
      try {
        await persistPending(this.storage, this.storageKey, this.serverGeneration, this.pending, [
          item.eventId,
        ]);
        flushed.push(item);
      } catch (error) {
        this.pending.set(eventId, item);
        throw error;
      }
    }
    return flushed;
  }

  async clear() {
    await clearPendingEvents(this.storage, this.storageKey, this.serverGeneration, this.pending);
  }

  async discard() {
    this.pending.clear();
    await withOutboxLock(this.storageKey, async () => this.storage.removeItem(this.storageKey));
  }
}
