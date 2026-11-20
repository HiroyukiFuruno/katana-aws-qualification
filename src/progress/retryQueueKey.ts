import type { Attempt } from '../attempts';
import type { PendingEvent } from './retryOutboxStorage';

export function eventKey(certificationId: string, attempt: Attempt) {
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

export function pendingFor(pending: Iterable<PendingEvent>, certificationId: string, attempt: Attempt) {
  const key = eventKey(certificationId, attempt);
  return [...pending].find((event) => eventKey(event.certificationId, event.attempt) === key);
}
