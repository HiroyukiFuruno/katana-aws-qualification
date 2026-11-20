import { withHistoryLock } from '../historyLock';
import { type BrowserStorage, canPersistGuestProgress } from '../progress/guest';
import { readDashboardPreferences } from './preferenceCodec';
import type { DashboardPreferences } from './preferenceTypes';
import { type DashboardStoredSettings, readDashboardSettings } from './settingsCodec';

export const dashboardSettingsKey = 'katana.dashboard-settings.v1';
export class DashboardSettingsConflict extends Error {}

export function createGuestDashboardSettings(storage: BrowserStorage, isCurrent: () => boolean) {
  const current = () => {
    if (!isCurrent() || !canPersistGuestProgress(storage))
      throw new Error('Dashboard settings access changed.');
  };
  const read = (): DashboardStoredSettings => {
    current();
    const raw = storage.getItem(dashboardSettingsKey);
    if (raw === null) return { revision: 0, settings: null, invalid: false };
    try {
      return readDashboardSettings(JSON.parse(raw));
    } catch {
      return { revision: 0, settings: null, invalid: true };
    }
  };
  return {
    load: read,
    save(settings: DashboardPreferences, revision: number) {
      const canonical = readDashboardPreferences(settings);
      return withHistoryLock(() => {
        current();
        const latest = read();
        if (!latest.invalid && JSON.stringify(latest.settings) === JSON.stringify(canonical))
          return latest;
        if (latest.revision !== revision)
          throw new DashboardSettingsConflict('Dashboard settings changed in another tab.');
        const next = { revision: revision + 1, settings: canonical };
        const raw = JSON.stringify(next);
        storage.setItem(dashboardSettingsKey, raw);
        if (storage.getItem(dashboardSettingsKey) !== raw)
          throw new Error('Dashboard settings save was not confirmed.');
        current();
        return { ...next, invalid: false };
      });
    },
  };
}
