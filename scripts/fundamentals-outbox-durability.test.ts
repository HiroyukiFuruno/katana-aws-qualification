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
  denied = false;
  await queue.execute(lessonAsset, a);
  expect(repo.calls).toEqual([a.input]);
  expect(store.getItem(lessonOutboxKey(userId))).toBeNull();
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
