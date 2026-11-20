import { expect, test } from 'bun:test';
import otherData from '../public/fundamentals/delivery/core-services.json' with { type: 'json' };
import type { DeliveryUnitAsset } from '../src/fundamentals/delivery/artifactTypes';
import { createLessonOutbox } from '../src/fundamentals/state/outbox';
import { lessonOutboxKey } from '../src/fundamentals/state/outboxCodec';
import { command, ids, outbox, repository, storage, userId } from './fundamentals-outbox-fixture';
import { emptyLessonSnapshot, lessonAsset } from './fundamentals-state-fixture';

test('unit-scoped recovery preserves a conflicting command without executing it for another unit', async () => {
  const other = otherData as DeliveryUnitAsset;
  const store = storage();
  const calls: string[] = [];
  const repo = repository(async () => emptyLessonSnapshot()).value;
  repo.recordStep = async (asset) => {
    calls.push(asset.unit.id);
    if (asset.unit.id === lessonAsset.unit.id)
      throw Object.assign(new Error('revision'), { code: 'PT412' });
    return { ...emptyLessonSnapshot(), unitId: asset.unit.id, contentVersion: asset.contentVersion };
  };
  const queue = createLessonOutbox({
    storage: store,
    repository: repo,
    resolveAsset: (id) => (id === other.unit.id ? other : lessonAsset),
    userId,
    isCurrent: () => true,
  });
  await queue.initialize();
  const a = command(ids[0] ?? '');
  await expect(queue.execute(lessonAsset, a)).rejects.toMatchObject({ code: 'PT412' });
  const b = { ...command(ids[1] ?? ''), unitId: other.unit.id, contentVersion: other.contentVersion };
  await queue.execute(other, b);
  const scope = { unitId: other.unit.id, contentVersion: other.contentVersion };
  await queue.flush(scope);
  expect(queue.hasPending(scope)).toBe(false);
  expect(queue.hasPending(a)).toBe(true);
  expect(calls).toEqual([lessonAsset.unit.id, other.unit.id]);
  expect(JSON.parse(store.getItem(lessonOutboxKey(userId)) ?? '').commands).toEqual([a]);
  await expect(queue.flush(a)).rejects.toMatchObject({ code: 'PT412' });
});

test('a restored queue does not resurrect a command discarded by another queue', async () => {
  const store = storage();
  const a = command(ids[0] ?? '');
  const b = command(ids[1] ?? '');
  const producer = repository(async (input) => {
    if (input.receiptId === a.input.receiptId)
      throw Object.assign(new Error('revision'), { code: 'PT412' });
    return emptyLessonSnapshot();
  });
  const first = outbox(store, producer.value);
  await first.initialize();
  await expect(first.execute(lessonAsset, a)).rejects.toMatchObject({ code: 'PT412' });
  const secondRepo = repository(async () => emptyLessonSnapshot());
  const second = outbox(store, secondRepo.value);
  await second.initialize();
  await first.discardUnit(lessonAsset.unit.id, lessonAsset.contentVersion);
  await second.execute(lessonAsset, b);
  await second.flush({ unitId: lessonAsset.unit.id, contentVersion: lessonAsset.contentVersion });
  await expect(second.execute(lessonAsset, a)).rejects.toMatchObject({ code: 'PT412' });
  expect(secondRepo.calls.map((input) => input.receiptId)).toEqual([b.input.receiptId]);
  expect(store.getItem(lessonOutboxKey(userId))).toBeNull();
});

test('an acknowledged command is not replayed by a stale restored queue', async () => {
  const store = storage();
  const a = command(ids[2] ?? '');
  const b = command(ids[3] ?? '');
  const producer = repository(async () => {
    throw Object.assign(new Error('offline'), { code: 'PT412' });
  });
  const seed = outbox(store, producer.value);
  await seed.initialize();
  await expect(seed.execute(lessonAsset, a)).rejects.toMatchObject({ code: 'PT412' });
  const firstRepo = repository(async () => emptyLessonSnapshot());
  const first = outbox(store, firstRepo.value);
  const secondRepo = repository(async () => emptyLessonSnapshot());
  const second = outbox(store, secondRepo.value);
  await first.initialize();
  await second.initialize();
  await first.execute(lessonAsset, a);
  await second.execute(lessonAsset, b);
  await expect(second.execute(lessonAsset, a)).rejects.toMatchObject({ code: 'PT412' });
  expect(secondRepo.calls.map((input) => input.receiptId)).toEqual([b.input.receiptId]);
});
