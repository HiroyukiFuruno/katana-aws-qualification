import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { parseDeliveryIndex } from '../../src/fundamentals/delivery/loadIndex';
import { parseDeliveryUnit } from '../../src/fundamentals/delivery/loadUnit';
import { createLessonServices } from '../../src/fundamentals/state/services';
import type { LessonSnapshot } from '../../src/fundamentals/state/types';
import { replaceLoadedAsset } from '../../src/fundamentals/state/useLessonUnit';

const root = new URL('../..', import.meta.url);

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

function servicesFor(
  index: Awaited<ReturnType<typeof parseDeliveryIndex>>,
  asset: ReturnType<typeof parseDeliveryUnit>,
) {
  return createLessonServices({
    assets: {
      index: async () => index,
      unit: async () => asset,
      editions: async () => [],
    },
    storage: { getItem: () => null, removeItem() {}, setItem() {} },
    isCurrent: () => true,
  });
}

test('keeps the latest snapshot when a delayed localized asset resolves', async () => {
  const index = parseDeliveryIndex(
    JSON.parse(await readFile(new URL('./public/fundamentals/delivery/index.json', root), 'utf8')),
  );
  const entry = index.units[0];
  if (!entry) throw new Error('Missing delivery unit fixture.');
  const source = JSON.parse(
    await readFile(new URL(`./public/fundamentals/delivery/${entry.slug}.json`, root), 'utf8'),
  );
  const deliveryAsset = parseDeliveryUnit(source, entry);
  const services = servicesFor(index, deliveryAsset);
  const scope = {
    services,
    unitId: deliveryAsset.unit.id,
    contentVersion: deliveryAsset.contentVersion,
    version: 0,
  };
  const snapshot: LessonSnapshot = {
    unitId: deliveryAsset.unit.id,
    contentVersion: deliveryAsset.contentVersion,
    progress: {
      completedCheckpointIds: [],
      completedSlideIds: [],
      furthestPlanPosition: 0,
      resumeStage: 'slide',
      resumeStepId: null,
      activeFinalSessionId: null,
      passedFinalSessionId: null,
      passedAt: null,
      revision: 1,
    },
    sessions: [],
  };
  const original = {
    asset: deliveryAsset,
    services,
    snapshot,
    version: scope.version,
  };
  const localized = {
    ...deliveryAsset,
    unit: { ...deliveryAsset.unit, title: 'English title' },
  };
  const asset = deferred<typeof localized>();
  let loaded = original;
  void asset.promise.then((resolved) => {
    const next = replaceLoadedAsset(loaded, resolved, scope);
    if (next) loaded = next;
  });

  const firstStep = deliveryAsset.steps[0];
  if (!firstStep) throw new Error('Missing delivery step fixture.');
  const savedSnapshot: LessonSnapshot = {
    ...snapshot,
    progress: {
      ...snapshot.progress,
      completedSlideIds: [firstStep.id],
      furthestPlanPosition: 1,
      revision: 2,
    },
  };
  loaded = { ...loaded, snapshot: savedSnapshot };
  asset.resolve(localized);
  await asset.promise;

  expect(loaded.asset).toBe(localized);
  expect(loaded.snapshot).toBe(savedSnapshot);
  expect(loaded.snapshot.progress).toEqual(savedSnapshot.progress);
});
