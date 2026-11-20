import type { Attempt } from '../attempts';
import type { MemberEvent, MemberProgressRepository } from './member';
import type { MemberProgressOwner } from './types';

type PendingEvent = { attempt: Attempt; certificationId: string; eventId: string };

function eventKey(certificationId: string, attempt: Attempt) {
  const selected = attempt.format ? attempt.selected : [...attempt.selected].sort();
  return JSON.stringify([
    certificationId,
    attempt.questionId,
    attempt.questionRevision,
    attempt.mode,
    attempt.format,
    selected,
  ]);
}

export class MemberRetryQueue {
  readonly owner: MemberProgressOwner;
  readonly pending = new Map<string, PendingEvent>();

  constructor(owner: MemberProgressOwner) {
    this.owner = owner;
  }

  enqueue(certificationId: string, attempt: Attempt) {
    const key = eventKey(certificationId, attempt);
    const current = this.pending.get(key);
    if (current) return current;
    const event = { certificationId, attempt, eventId: crypto.randomUUID() };
    this.pending.set(key, event);
    return event;
  }

  has(certificationId: string, attempt: Attempt) {
    return this.pending.has(eventKey(certificationId, attempt));
  }

  async append(repository: MemberProgressRepository, certificationId: string, attempt: Attempt) {
    const key = eventKey(certificationId, attempt);
    const retrying = this.pending.get(key);
    const flushed = await this.flush(repository);
    if (retrying) return flushed;
    this.enqueue(certificationId, attempt);
    return [...flushed, ...(await this.flush(repository))];
  }

  async flush(repository: MemberProgressRepository) {
    if (repository.owner !== this.owner) throw new Error('A retry queue cannot change progress owner.');
    const flushed: PendingEvent[] = [];
    for (const [key, item] of this.pending) {
      const event: MemberEvent = {
        ...item.attempt,
        certificationId: item.certificationId,
        eventId: item.eventId,
      };
      await repository.append(event);
      this.pending.delete(key);
      flushed.push(item);
    }
    return flushed;
  }

  clear() {
    this.pending.clear();
  }
}
