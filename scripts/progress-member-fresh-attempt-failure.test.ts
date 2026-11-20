import { expect, test } from 'bun:test';
import { AuthApiError, AuthRetryableFetchError } from '@supabase/auth-js';
import type { Attempt } from '../src/attempts';
import { createProgressStore } from '../src/progress';
import { ProgressApiError } from '../src/progress/api';
import { retryStorageKey } from '../src/progress/retryOutboxStorage';
import {
  client,
  owner,
  prepared,
  right,
  storage,
  wrong,
} from './progress-member-fresh-attempt-failure-fixture';

test('transient fresh-read failures queue the prepared event unchanged and reject the original error', async () => {
  for (const offline of [
    new TypeError('network unavailable'),
    new ProgressApiError(503, 'service_unavailable'),
    new AuthRetryableFetchError('auth transport unavailable', 0),
    new AuthRetryableFetchError('auth service unavailable', 503),
  ]) {
    const local = storage();
    const writes: Record<string, unknown>[] = [];
    let failRead = false;
    const store = createProgressStore({
      client: client(() => (failRead ? offline : undefined), writes),
      isCurrent: () => true,
      owner,
      storage: local,
    });
    await store.initialize();
    await expect(store.appendAttempt('saa-c03', wrong)).rejects.toThrow('offline');
    failRead = true;
    await expect(store.appendAttempt('saa-c03', right, prepared)).rejects.toBe(offline);
    const pending = JSON.parse(local.getItem(retryStorageKey(owner)) ?? '{}') as {
      events?: { eventId: string; attempt: Attempt }[];
    };
    expect(pending.events).toHaveLength(1);
    expect(pending.events?.[0]?.attempt).toMatchObject({ attemptNumber: 2, priorIncorrectCount: 1 });
    const eventId = pending.events?.[0]?.eventId;
    failRead = false;
    await store.retryPending();
    expect(writes.at(-1)).toMatchObject({
      attempt_number: 2,
      event_id: eventId,
      prior_incorrect_count: 1,
    });
  }
});

test('auth, generation and malformed fresh reads do not enqueue an unverified new event', async () => {
  for (const error of [
    new AuthApiError('unauthorized', 401, 'bad_jwt'),
    new ProgressApiError(403, '42501'),
    new ProgressApiError(409, 'PT409'),
    new SyntaxError('invalid response'),
  ]) {
    const local = storage();
    const writes: Record<string, unknown>[] = [];
    let failRead = false;
    const store = createProgressStore({
      client: client(() => (failRead ? error : undefined), writes),
      isCurrent: () => true,
      owner,
      storage: local,
    });
    await store.initialize();
    failRead = true;
    await expect(store.appendAttempt('saa-c03', right, prepared)).rejects.toBe(error);
    expect(local.getItem(retryStorageKey(owner))).toBeNull();
    expect(writes).toHaveLength(0);
  }
});

test('an owner change while preparing never queues a new stale event', async () => {
  const local = storage();
  const writes: Record<string, unknown>[] = [];
  let active = true;
  const store = createProgressStore({
    client: client(() => undefined, writes),
    isCurrent: () => active,
    owner,
    storage: local,
  });
  await store.initialize();
  await expect(store.appendAttempt('saa-c03', wrong)).rejects.toThrow('offline');
  await expect(
    store.appendAttempt('saa-c03', right, (history) => {
      queueMicrotask(() => {
        active = false;
      });
      return prepared(history);
    }),
  ).rejects.toThrow('Progress owner changed');
  expect(local.getItem(retryStorageKey(owner))).toBeNull();
  expect(writes).toHaveLength(2);
});

test('an owner change after persisting an event removes only that stale event', async () => {
  const values = new Map<string, string>();
  let active = true;
  let injectOtherTabEvent = false;
  const other = { attempt: wrong, certificationId: 'saa-c03', eventId: 'other-tab-event' };
  const local = {
    getItem: (key: string) => {
      if (injectOtherTabEvent) {
        injectOtherTabEvent = false;
        values.set(key, JSON.stringify({ events: [other], generation: 1, version: 1 }));
      }
      return values.get(key) ?? null;
    },
    removeItem: (key: string) => void values.delete(key),
    setItem: (key: string, value: string) => {
      values.set(key, value);
      queueMicrotask(() => {
        active = false;
      });
    },
  };
  const writes: Record<string, unknown>[] = [];
  const store = createProgressStore({
    client: client(() => undefined, writes),
    isCurrent: () => active,
    owner,
    storage: local,
  });
  await store.initialize();
  injectOtherTabEvent = true;
  await expect(store.appendAttempt('saa-c03', right, prepared)).rejects.toThrow(
    'Progress owner changed',
  );
  expect(JSON.parse(local.getItem(retryStorageKey(owner)) ?? '{}')).toMatchObject({
    events: [{ eventId: other.eventId }],
  });
  expect(writes).toHaveLength(0);
});
