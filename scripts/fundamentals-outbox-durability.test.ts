import { expect, test } from 'bun:test';
import { lessonOutboxKey, persistLessonOutbox } from '../src/fundamentals/state/outboxCodec';
import { command, ids, outbox, repository, storage, userId } from './fundamentals-outbox-fixture';
import { emptyLessonSnapshot, lessonAsset } from './fundamentals-state-fixture';

test('a failed essential write retains the same command but prevents RPC until persistence succeeds', async () => {
  const store = storage();
  const write = store.setItem;
  let denied = true;
  store.setItem = (key, value) => {
    if (denied) throw new Error('storage denied');
    write(key, value);
  };
  const repo = repository(async () => emptyLessonSnapshot());
  const queue = outbox(store, repo.value);
  await queue.initialize();
  const a = command(ids[0] ?? '');
  await expect(queue.execute(lessonAsset, a)).rejects.toThrow('storage denied');
  expect(repo.calls).toEqual([]);
  expect(queue.hasPending(a)).toBe(true);
  expect(queue.isPersisted(a)).toBe(false);
  expect(queue.hasPersistedPending(a)).toBe(false);
  denied = false;
  await queue.execute(lessonAsset, a);
  expect(repo.calls).toEqual([a.input]);
  expect(store.getItem(lessonOutboxKey(userId))).toBeNull();
});

test('durability compares the exact command against current owner storage without rewriting it', async () => {
  const store = storage();
  const repo = repository(async () => {
    throw new Error('offline');
  });
  const queue = outbox(store, repo.value);
  await queue.initialize();
  const a = command(ids[0] ?? '');
  await expect(queue.execute(lessonAsset, a)).rejects.toThrow('offline');
  const raw = store.getItem(lessonOutboxKey(userId));
  expect(queue.isPersisted(a)).toBe(true);
  expect(queue.hasPersistedPending(a)).toBe(true);
  expect(queue.isPersisted(command(ids[1] ?? ''))).toBe(false);
  expect(queue.isPersisted({ ...a, input: { ...a.input, expectedRevision: 99 } })).toBe(false);
  expect(store.getItem(lessonOutboxKey(userId))).toBe(raw);
  store.removeItem(lessonOutboxKey(userId));
  expect(queue.hasPending(a)).toBe(true);
  expect(queue.isPersisted(a)).toBe(false);
  expect(queue.hasPersistedPending(a)).toBe(false);
});

test('another persisted command cannot prove durability for a new command whose write failed', async () => {
  const store = storage();
  const queue = outbox(
    store,
    repository(async () => {
      throw new Error('offline');
    }).value,
  );
  await queue.initialize();
  const a = command(ids[0] ?? '');
  const b = command(ids[1] ?? '');
  await expect(queue.execute(lessonAsset, b)).rejects.toThrow('offline');
  store.setItem = () => {
    throw new Error('quota');
  };
  await expect(queue.execute(lessonAsset, a)).rejects.toThrow('quota');
  expect(queue.isPersisted(b)).toBe(true);
  expect(queue.isPersisted(a)).toBe(false);
  expect(queue.hasPersistedPending(a)).toBe(false);
  expect(JSON.parse(store.getItem(lessonOutboxKey(userId)) ?? '').commands).toEqual([b]);
});

test('discovering a newer shared generation invalidates the old current command and retains new commands', async () => {
  const store = storage();
  const repo = repository(async () => emptyLessonSnapshot(), [0, 1]);
  const queue = outbox(store, repo.value);
  await queue.initialize();
  const a = command(ids[0] ?? '');
  const b = command(ids[1] ?? '');
  persistLessonOutbox(store, lessonOutboxKey(userId), userId, 1, [b]);
  await expect(queue.execute(lessonAsset, a)).rejects.toMatchObject({ code: 'PT409' });
  await expect(queue.execute(lessonAsset, a)).rejects.toMatchObject({ code: 'PT412' });
  expect(repo.calls).toEqual([]);
  expect(JSON.parse(store.getItem(lessonOutboxKey(userId)) ?? '').commands).toEqual([b]);
});
