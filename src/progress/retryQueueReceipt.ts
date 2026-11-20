import type { PendingEvent } from './retryOutboxStorage';

const receipts = new WeakMap<object, PendingEvent[]>();

export function withFlushedEvents(error: unknown, flushed: PendingEvent[]) {
  if (!flushed.length) return error;
  if (error !== null && typeof error === 'object') {
    receipts.set(error, flushed);
    return error;
  }
  const wrapped = new Error(String(error));
  receipts.set(wrapped, flushed);
  return wrapped;
}

export function flushedEventsFor(error: unknown) {
  return error !== null && typeof error === 'object' ? (receipts.get(error) ?? []) : [];
}
