import type { DeliveryIndexAsset, DeliveryUnitAsset } from './artifactTypes';
import { type LessonEdition, loadArchivedLessonEditions } from './editions';
import { loadDeliveryIndex } from './loadIndex';
import { loadDeliveryUnit } from './loadUnit';

export function createLessonAssets() {
  let index: Promise<DeliveryIndexAsset> | undefined;
  let history: Promise<LessonEdition[]> | undefined;
  const units = new Map<string, Promise<DeliveryUnitAsset>>();
  const getIndex = () => {
    if (!index) {
      const pending = loadDeliveryIndex();
      index = pending;
      void pending.catch(() => {
        if (index === pending) index = undefined;
      });
    }
    return index;
  };
  const getHistory = () => {
    if (!history) {
      const pending = loadArchivedLessonEditions();
      history = pending;
      void pending.catch(() => {
        if (history === pending) history = undefined;
      });
    }
    return history;
  };
  const getUnit = async (unitId: string, contentVersion?: string) => {
    let catalog = await getIndex();
    let entry = catalog.units.find((entry) => entry.unitId === unitId);
    let basePath: string | undefined;
    if (contentVersion !== undefined && contentVersion !== entry?.contentVersion) {
      const edition = (await getHistory()).find(({ index }) =>
        index.units.some((entry) => entry.unitId === unitId && entry.contentVersion === contentVersion),
      );
      if (edition) {
        catalog = edition.index;
        entry = catalog.units.find((entry) => entry.unitId === unitId);
        basePath = edition.basePath;
      }
    }
    if (!entry || (contentVersion !== undefined && contentVersion !== entry.contentVersion)) {
      throw new Error('The lesson version is no longer published. Pending work has been retained.');
    }
    const key = `${entry.unitId}\u0000${entry.contentVersion}`;
    let pending = units.get(key);
    if (!pending) {
      pending = loadDeliveryUnit(catalog, unitId, { basePath });
      units.set(key, pending);
      const captured = pending;
      void pending.catch(() => {
        if (units.get(key) === captured) units.delete(key);
      });
    }
    return pending;
  };
  return {
    index: getIndex,
    unit: getUnit,
    editions: async (): Promise<LessonEdition[]> => [
      { index: await getIndex(), basePath: '/fundamentals/delivery' },
      ...(await getHistory()),
    ],
  };
}

export type LessonAssets = ReturnType<typeof createLessonAssets>;
