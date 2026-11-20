import { expect, test } from 'bun:test';
import otherData from '../public/fundamentals/delivery/core-services.json' with { type: 'json' };
import type { DeliveryUnitAsset } from '../src/fundamentals/delivery/artifactTypes';
import { createLessonOutbox } from '../src/fundamentals/state/outbox';
import { lessonOutboxKey } from '../src/fundamentals/state/outboxCodec';
import { command, ids, repository, storage, userId } from './fundamentals-outbox-fixture';
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
