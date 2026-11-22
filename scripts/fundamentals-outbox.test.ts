import { expect, test } from 'bun:test';
import { lessonOutboxKey } from '../src/fundamentals/state/outboxCodec';
import {
  command,
  ids,
  outbox,
  repository,
  startCommand,
  storage,
  userId,
} from './fundamentals-outbox-fixture';
import { emptyLessonSnapshot, lessonAsset } from './fundamentals-state-fixture';

test('keeps an immutable command across a transient failure and reload retry', async () => {
  const store = storage();
  let calls = 0;
  const first = repository(async () => {
    calls += 1;
    if (calls === 1) throw new TypeError('offline');
    return emptyLessonSnapshot();
  });
  const initial = outbox(store, first.value);
  await initial.initialize();
  await expect(initial.execute(lessonAsset, command(ids[0] ?? ''))).rejects.toThrow('offline');
  const retry = repository(async () => emptyLessonSnapshot());
  const restored = outbox(store, retry.value);
  await restored.initialize();
  await restored.flush();
  expect(retry.calls).toEqual(first.calls);
  expect(store.getItem(lessonOutboxKey(userId))).toBeNull();
});

test('retains a UUIDv8 presentation marker through member outbox reload', async () => {
  const store = storage();
  const offline = repository(async () => emptyLessonSnapshot());
  offline.value.startFinal = async () => {
    throw new TypeError('offline');
  };
  const command = startCommand('10000000-0000-8000-8000-000000000008');
  const initial = outbox(store, offline.value);
  await initial.initialize();
  await expect(initial.execute(lessonAsset, command)).rejects.toThrow('offline');

  const restored = outbox(store, repository(async () => emptyLessonSnapshot()).value);
  await restored.initialize();
  expect(restored.hasPending()).toBe(true);
  expect(JSON.parse(store.getItem(lessonOutboxKey(userId)) ?? '').commands).toEqual([command]);
});

test('merges distinct tab commands and retains corrupt storage', async () => {
  const store = storage();
  const offline = repository(async () => {
    throw new TypeError('offline');
  });
  const one = outbox(store, offline.value);
  await one.initialize();
  await expect(one.execute(lessonAsset, command(ids[0] ?? ''))).rejects.toThrow('offline');
  const two = outbox(store, offline.value);
  await two.initialize();
  await expect(two.execute(lessonAsset, command(ids[1] ?? ''))).rejects.toThrow('offline');
  expect(JSON.parse(store.getItem(lessonOutboxKey(userId)) ?? '').commands).toHaveLength(2);
  const raw = '{bad';
  store.setItem(lessonOutboxKey(userId), raw);
  await expect(outbox(store, offline.value).initialize()).rejects.toThrow('未同期');
  expect(store.getItem(lessonOutboxKey(userId))).toBe(raw);
});

test('rejects a same UUID payload conflict without replacing its original', async () => {
  const store = storage();
  const offline = repository(async () => {
    throw new TypeError('offline');
  });
  const queue = outbox(store, offline.value);
  await queue.initialize();
  const original = command(ids[0] ?? '');
  await expect(queue.execute(lessonAsset, original)).rejects.toThrow('offline');
  await expect(queue.execute(lessonAsset, command(ids[0] ?? '', 1))).rejects.toThrow('conflict');
  expect(JSON.parse(store.getItem(lessonOutboxKey(userId)) ?? '').commands[0]).toEqual(original);
});

test('purges stale generation commands and requires explicit discard for PT412', async () => {
  const store = storage();
  const stale = Object.assign(new Error('reset'), { code: 'PT409' });
  const conflict = repository(async () => {
    throw stale;
  }, [1, 2]);
  conflict.value.startFinal = async () => {
    throw stale;
  };
  const queue = outbox(store, conflict.value);
  await queue.initialize();
  const old = startCommand(ids[0] ?? '');
  await expect(queue.execute(lessonAsset, old)).rejects.toBe(stale);
  await expect(queue.execute(lessonAsset, old)).rejects.toMatchObject({ code: 'PT412' });
  expect(queue.hasPending()).toBe(false);
  const retry = outbox(
    store,
    repository(async () => {
      throw Object.assign(new Error('revision'), { code: 'PT412' });
    }).value,
  );
  await retry.initialize();
  await expect(retry.execute(lessonAsset, command(ids[1] ?? ''))).rejects.toThrow('revision');
  expect(retry.hasPending()).toBe(true);
  await retry.discardUnit(lessonAsset.unit.id, lessonAsset.contentVersion);
  expect(store.getItem(lessonOutboxKey(userId))).toBeNull();
});

test('removes only its command when ownership changes after storage or RPC awaits', async () => {
  let current = true;
  const firstStore = storage();
  const first = outbox(firstStore, repository(async () => emptyLessonSnapshot()).value, () => current);
  await first.initialize();
  const setItem = firstStore.setItem;
  firstStore.setItem = (key, value) => {
    setItem(key, value);
    current = false;
  };
  await expect(first.execute(lessonAsset, command(ids[0] ?? ''))).rejects.toThrow('owner changed');
  expect(firstStore.getItem(lessonOutboxKey(userId))).toBeNull();
  current = true;
  const secondStore = storage();
  const second = outbox(
    secondStore,
    repository(async () => {
      current = false;
      return emptyLessonSnapshot();
    }).value,
    () => current,
  );
  await second.initialize();
  await expect(second.execute(lessonAsset, command(ids[1] ?? ''))).rejects.toThrow('owner changed');
  expect(secondStore.getItem(lessonOutboxKey(userId))).toBeNull();
});
