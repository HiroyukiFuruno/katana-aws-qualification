import type { Attempt } from '../attempts';
import { recoverAttempt } from './errors';
import type { MemberProgressRepository } from './member';
import type { MemberRetryQueue } from './retryQueue';
import { flushedEventsFor } from './retryQueueReceipt';
import type { ProgressReadyData, ProgressSnapshot, ProgressStoreInput } from './storeTypes';
import { eventKey } from './retryQueue';
import type { PendingEvent } from './retryOutboxStorage';

type StoredAttempt = Attempt & { certificationId?: unknown; eventId?: unknown };

function attemptIdentity(attempt: Attempt) {
  const event = attempt as StoredAttempt;
  return typeof event.eventId === 'string'
    ? `event:${event.eventId}`
    : eventKey(typeof event.certificationId === 'string' ? event.certificationId : '', attempt);
}

export function mergeMemberAttempts(current: Attempt[], flushed: PendingEvent[]) {
  const attempts = new Map(current.map((item) => [attemptIdentity(item), item]));
  for (const item of flushed) {
    const event = { ...item.attempt, certificationId: item.certificationId, eventId: item.eventId };
    attempts.set(attemptIdentity(event), event);
  }
  return [...attempts.values()];
}

export function memberAttemptSnapshot(
  snapshot: ProgressSnapshot,
  flushed: PendingEvent[],
): ProgressReadyData {
  return {
    attempts: mergeMemberAttempts(snapshot.attempts, flushed),
    corruptRows: snapshot.corruptRows,
    profile: snapshot.profile,
    profileRevision: snapshot.profileRevision,
  };
}

export function memberAttemptReceipt(error: unknown, snapshot: ProgressSnapshot) {
  const flushed = flushedEventsFor(error);
  return flushed.length ? memberAttemptSnapshot(snapshot, flushed) : undefined;
}

export function publishMemberAttemptReceipt(
  error: unknown,
  snapshot: ProgressSnapshot,
  ready: (next: ProgressReadyData) => void,
) {
  const receipt = memberAttemptReceipt(error, snapshot);
  if (receipt) ready(receipt);
}

export async function recoverMemberAttempt(
  input: ProgressStoreInput,
  error: unknown,
  queue: MemberRetryQueue | undefined,
  member: MemberProgressRepository | undefined,
  getSnapshot: () => ProgressSnapshot,
  ready: (next: ProgressReadyData) => void,
  failed: (error: 'save') => void,
) {
  publishMemberAttemptReceipt(error, getSnapshot(), ready);
  await recoverAttempt(input, error, queue, member, failed);
}

export async function retryMemberPending(
  member: MemberProgressRepository | undefined,
  queue: MemberRetryQueue | undefined,
  initialize: () => Promise<ProgressSnapshot>,
  input: ProgressStoreInput,
  getSnapshot: () => ProgressSnapshot,
  ready: (next: ProgressReadyData) => void,
  failed: (error: 'save') => void,
) {
  try {
    await (member && queue ? queue.flush(member) : Promise.resolve());
    await initialize();
  } catch (error) {
    await recoverMemberAttempt(input, error, queue, member, getSnapshot, ready, failed);
    throw error;
  }
}
