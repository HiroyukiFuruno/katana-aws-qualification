import { dashboardNumber, dashboardRecord } from './codec';
import { readDashboardPreferences } from './preferenceCodec';
import type { DashboardSettingsSnapshot } from './preferenceTypes';

export type DashboardStoredSettings = DashboardSettingsSnapshot & { invalid: boolean };

export function readDashboardSettings(value: unknown): DashboardStoredSettings {
  const row = dashboardRecord(value, ['revision', 'settings']);
  const revision = dashboardNumber(row.revision);
  if (row.settings === null) {
    if (revision !== 0) throw new Error('Missing saved dashboard settings.');
    return { revision, settings: null, invalid: false };
  }
  try {
    return { revision, settings: readDashboardPreferences(row.settings), invalid: false };
  } catch {
    return { revision, settings: null, invalid: true };
  }
}
