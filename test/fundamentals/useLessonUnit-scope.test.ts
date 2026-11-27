import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { parseDeliveryIndex } from '../../src/fundamentals/delivery/loadIndex';
import { parseDeliveryUnit } from '../../src/fundamentals/delivery/loadUnit';
import { createLessonServices } from '../../src/fundamentals/state/services';
import type { LessonSnapshot } from '../../src/fundamentals/state/types';
import { replaceLoadedAsset } from '../../src/fundamentals/state/useLessonUnit';

const root = new URL('../..', import.meta.url);

function servicesFor(
  index: Awaited<ReturnType<typeof parseDeliveryIndex>>,
  asset: ReturnType<typeof parseDeliveryUnit>,
) {
  return createLessonServices({
    assets: {
      index: async () => index,
      unit: async () => asset,
      record: async () => undefined,
    },
    storage: { getItem: () => null, removeItem() {}, setItem() {} },
    isCurrent: () => true,
  });
}

function snapshotFor(asset: ReturnType<typeof parseDeliveryUnit>): LessonSnapshot {
  return {
    unitId: asset.unit.id,
    contentVersion: asset.contentVersion,
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
}

test('rejects localized assets outside the retained lesson scope', async () => {
  const index = parseDeliveryIndex(
    JSON.parse(await readFile(new URL('./public/fundamentals/delivery/index.json', root), 'utf8')),
  );
  const [entry, otherEntry] = index.units;
  if (!entry || !otherEntry) throw new Error('Missing delivery unit fixtures.');
  const asset = parseDeliveryUnit(
    JSON.parse(
      await readFile(new URL(`./public/fundamentals/delivery/${entry.slug}.json`, root), 'utf8'),
    ),
    entry,
  );
  const otherAsset = parseDeliveryUnit(
    JSON.parse(
      await readFile(new URL(`./public/fundamentals/delivery/${otherEntry.slug}.json`, root), 'utf8'),
    ),
    otherEntry,
  );
  const services = servicesFor(index, asset);
  const loaded = { asset, services, snapshot: snapshotFor(asset), version: 0 };
  const scope = { services, unitId: asset.unit.id, contentVersion: asset.contentVersion, version: 0 };
  const localized = { ...asset, unit: { ...asset.unit, title: 'English title' } };
  const currentOtherUnit = {
    asset: otherAsset,
    services,
    snapshot: snapshotFor(otherAsset),
    version: 0,
  };
  const cases = [
    { current: { ...loaded, services: servicesFor(index, asset) }, incoming: localized, scope },
    { current: currentOtherUnit, incoming: localized, scope },
    { current: { ...loaded, version: 1 }, incoming: localized, scope },
    { current: loaded, incoming: otherAsset, scope },
    {
      current: loaded,
      incoming: { ...localized, contentVersion: `${localized.contentVersion}-new` },
      scope,
    },
    { current: loaded, incoming: localized, scope: { ...scope, contentVersion: 'pinned-version' } },
  ];
  for (const candidate of cases)
    expect(replaceLoadedAsset(candidate.current, candidate.incoming, candidate.scope)).toBe(
      candidate.current,
    );
});
