import { expect, test } from 'bun:test';
import {
  createGuestDashboardSettings,
  DashboardSettingsConflict,
  dashboardSettingsKey,
} from '../src/dashboard/guestSettings';
import { dashboardDefaults } from '../src/dashboard/preferences';
import { setGuestProgressConsent } from '../src/progress/guest';
import { memoryStorage } from './memory-storage.fixture';

test('denied guest never reads or writes saved dashboard settings', async () => {
  const storage = memoryStorage();
  storage.setItem(dashboardSettingsKey, 'private settings');
  const original = storage.getItem;
  const reads: string[] = [];
  storage.getItem = (key) => {
    reads.push(key);
    return original(key);
  };
  const repository = createGuestDashboardSettings(storage, () => true);
  expect(() => repository.load()).toThrow();
  await expect(repository.save(dashboardDefaults('UTC'), 0)).rejects.toThrow();
  expect(reads).not.toContain(dashboardSettingsKey);
  expect(storage.values.get(dashboardSettingsKey)).toBe('private settings');
});

test('settings save is idempotent and concurrent different payloads conflict', async () => {
  const storage = memoryStorage();
  setGuestProgressConsent(storage, true);
  let current = true;
  const first = createGuestDashboardSettings(storage, () => current);
  const second = createGuestDashboardSettings(storage, () => true);
  expect(first.load().revision).toBe(0);
  const settings = dashboardDefaults('UTC');
  expect((await first.save(settings, 0)).revision).toBe(1);
  expect((await first.save(settings, 0)).revision).toBe(1);
  settings.widgets[0].width = 'normal';
  await expect(second.save(settings, 0)).rejects.toBeInstanceOf(DashboardSettingsConflict);
  expect((await second.save(settings, 1)).revision).toBe(2);
  current = false;
  await expect(first.save(settings, 2)).rejects.toThrow();
});

test('corrupt settings are retained until explicit save repairs them', async () => {
  const storage = memoryStorage();
  setGuestProgressConsent(storage, true);
  storage.setItem(dashboardSettingsKey, '{broken');
  const repository = createGuestDashboardSettings(storage, () => true);
  expect(repository.load()).toEqual({ settings: null, revision: 0, invalid: true });
  expect(storage.getItem(dashboardSettingsKey)).toBe('{broken');
  expect((await repository.save(dashboardDefaults('UTC'), 0)).invalid).toBe(false);
  expect(repository.load().revision).toBe(1);
});
