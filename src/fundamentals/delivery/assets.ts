import type { Locale } from '../../locales';
import type { DeliveryIndexAsset, DeliveryUnitAsset } from './artifactTypes';
import { legacyLessonRecord } from './legacyRecordAsset';
import { loadDeliveryIndex } from './loadIndex';
import { loadDeliveryUnit } from './loadUnit';
import type { LessonRecordAsset } from './recordAsset';
import { storedLessonRecord } from './recordStorage';

export function createLessonAssets() {
  const indexes = new Map<Locale, Promise<DeliveryIndexAsset>>();
  const units = new Map<string, Promise<DeliveryUnitAsset>>();
  const getIndex = (locale: Locale = 'ja') => {
    let index = indexes.get(locale);
    if (!index) {
      const pending = loadDeliveryIndex({ locale });
      indexes.set(locale, pending);
      void pending.catch(() => {
        if (indexes.get(locale) === pending) indexes.delete(locale);
      });
      index = pending;
    }
    return index;
  };
  const getUnit = async (unitId: string, contentVersion?: string, locale: Locale = 'ja') => {
    const catalog = await getIndex(locale);
    const entry = catalog.units.find((entry) => entry.unitId === unitId);
    if (!entry || (contentVersion !== undefined && contentVersion !== entry.contentVersion)) {
      throw new Error('The lesson version is no longer published. Pending work has been retained.');
    }
    const key = `${locale}\u0000${entry.unitId}\u0000${entry.contentVersion}`;
    let pending = units.get(key);
    if (!pending) {
      pending = loadDeliveryUnit(catalog, unitId, { locale });
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
    async record(
      unitId: string,
      contentVersion: string,
      locale: Locale = 'ja',
      storage?: Pick<Storage, 'getItem'>,
    ): Promise<LessonRecordAsset | undefined> {
      const index = await getIndex(locale);
      if (
        index.units.some((entry) => entry.unitId === unitId && entry.contentVersion === contentVersion)
      ) {
        return getUnit(unitId, contentVersion, locale);
      }
      const legacy = await legacyLessonRecord(unitId, contentVersion);
      return legacy ?? (storage && storedLessonRecord(storage, unitId, contentVersion));
    },
  };
}

export type LessonAssets = ReturnType<typeof createLessonAssets>;
