import type { Locale } from '../../locales';
import type { DeliveryIndexAsset, DeliveryUnitAsset } from './artifactTypes';
import { type LessonEdition, loadArchivedLessonEditions } from './editions';
import { loadDeliveryIndex } from './loadIndex';
import { loadDeliveryUnit } from './loadUnit';

export function createLessonAssets() {
  const indexes = new Map<Locale, Promise<DeliveryIndexAsset>>();
  const histories = new Map<Locale, Promise<LessonEdition[]>>();
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
  const getHistory = (locale: Locale = 'ja') => {
    let history = histories.get(locale);
    if (!history) {
      const pending = loadArchivedLessonEditions(locale);
      histories.set(locale, pending);
      void pending.catch(() => {
        if (histories.get(locale) === pending) histories.delete(locale);
      });
      history = pending;
    }
    return history;
  };
  const getUnit = async (unitId: string, contentVersion?: string, locale: Locale = 'ja') => {
    let catalog = await getIndex(locale);
    let entry = catalog.units.find((entry) => entry.unitId === unitId);
    let basePath: string | undefined;
    if (contentVersion !== undefined && contentVersion !== entry?.contentVersion) {
      const edition = (await getHistory(locale)).find(({ index }) =>
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
    const key = `${locale}\u0000${entry.unitId}\u0000${entry.contentVersion}`;
    let pending = units.get(key);
    if (!pending) {
      pending = loadDeliveryUnit(catalog, unitId, { basePath, locale });
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
    editions: async (locale: Locale = 'ja'): Promise<LessonEdition[]> => [
      { index: await getIndex(locale), basePath: '/fundamentals/delivery' },
      ...(await getHistory(locale)),
    ],
  };
}

export type LessonAssets = ReturnType<typeof createLessonAssets>;
