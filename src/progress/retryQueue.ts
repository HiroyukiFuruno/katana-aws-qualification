import type { Attempt } from '../attempts';
import type { MemberEvent, MemberProgressRepository } from './member';
import {
  persistOutbox,
  restoreOutbox,
  retryStorageKey,
  withOutboxLock,
  type PendingEvent,
  type RetryStorage,
} from './retryOutboxStorage';
import { flushedEventsFor, withFlushedEvents } from './retryQueueReceipt';
import { pendingFor } from './retryQueueKey';
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

  private persist(removeEventIds: Iterable<string> = []) {
    return withOutboxLock(this.storageKey, async () => {
      persistOutbox(
        this.storage,
        this.storageKey,
        this.serverGeneration,
        this.pending.values(),
        removeEventIds,
      );
    });
  }

  async enqueue(certificationId: string, attempt: Attempt) {
    const current = pendingFor(this.pending.values(), certificationId, attempt);
    if (current) return current;
    const event = { certificationId, attempt, eventId: crypto.randomUUID() };
    this.pending.set(event.eventId, event);
    try {
      await this.persist();
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
    prepare?: (flushed: PendingEvent[]) => Attempt,
  ) {
    const retrying = pendingFor(this.pending.values(), certificationId, attempt);
    const flushed = await this.flush(repository);
    if (retrying) return { attempt: retrying.attempt, flushed };
    const prepared = prepare?.(flushed) ?? attempt;
    try {
      await this.enqueue(certificationId, prepared);
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
        await this.persist([item.eventId]);
        flushed.push(item);
      } catch (error) {
        this.pending.set(eventId, item);
        throw error;
      }
    }
    return flushed;
  }

  async clear() {
    const previous = new Map(this.pending);
    this.pending.clear();
    if (this.serverGeneration === undefined) {
      await withOutboxLock(this.storageKey, async () => this.storage.removeItem(this.storageKey));
      return;
    }
    try {
      await this.persist([...previous.values()].map((event) => event.eventId));
    } catch (error) {
      for (const [eventId, value] of previous) this.pending.set(eventId, value);
      throw error;
    }
  }

  async discard() {
    this.pending.clear();
    await withOutboxLock(this.storageKey, async () => this.storage.removeItem(this.storageKey));
  }
}
