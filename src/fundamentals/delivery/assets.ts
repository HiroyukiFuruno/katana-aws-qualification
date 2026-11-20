import type { DeliveryIndexAsset, DeliveryUnitAsset } from './artifactTypes';
import { loadDeliveryIndex } from './loadIndex';
import { loadDeliveryUnit } from './loadUnit';

export function createLessonAssets() {
  let index: Promise<DeliveryIndexAsset> | undefined;
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
  const getUnit = async (unitId: string, contentVersion?: string) => {
    const catalog = await getIndex();
    const entry = catalog.units.find((entry) => entry.unitId === unitId);
    if (!entry || (contentVersion !== undefined && contentVersion !== entry.contentVersion)) {
      throw new Error('The lesson version is no longer published. Pending work has been retained.');
    }
    const key = `${entry.unitId}\u0000${entry.contentVersion}`;
    let pending = units.get(key);
    if (!pending) {
      pending = loadDeliveryUnit(catalog, unitId);
      units.set(key, pending);
      const captured = pending;
      void pending.catch(() => {
        if (units.get(key) === captured) units.delete(key);
      });
    }
    return pending;
  };
  return { index: getIndex, unit: getUnit };
}

export type LessonAssets = ReturnType<typeof createLessonAssets>;
