import { expect, test } from 'bun:test';
import index from '../public/fundamentals/delivery/index.json';
import archivedIndex from '../public/fundamentals/delivery/history/2026-11-20/index.json';
import { loadGuestDashboard } from '../src/dashboard/guestRecords';
import { guestLessonPrefix } from '../src/learningStorage';
import { setGuestProgressConsent } from '../src/progress/guest';
import { archivedAsset, archivedGuestFinal } from '../test/progress/fundamentals-edition.fixture';
import { lessonAsset } from './fundamentals-state-fixture';
import { memoryStorage } from './memory-storage.fixture';

function fixture() {
  const memory = memoryStorage();
  const storage = {
    ...memory,
    get length() {
      return memory.values.size;
    },
    key: (position: number) => [...memory.values.keys()][position] ?? null,
  };
  setGuestProgressConsent(storage, true);
  const key = `${guestLessonPrefix}${archivedAsset.unit.id}.${archivedAsset.contentVersion}`;
  const raw = JSON.stringify(archivedGuestFinal(true));
  storage.setItem(key, raw);
  return {
    key,
    raw,
    input: {
      storage,
      attempts: [],
      corruptRows: 0,
      resolve: async () => null,
      locale: 'ja' as const,
      isCurrent: () => true,
      assets: {
        index: async () => index,
        editions: async () => [
          { index, basePath: '/fundamentals/delivery' },
          { index: archivedIndex, basePath: '/fundamentals/delivery/history/2026-11-20' },
        ],
        unit: async (_id: string, version?: string) =>
          version === archivedAsset.contentVersion ? archivedAsset : lessonAsset,
      },
    },
  };
}

test('archived guest answers remain in analysis while current lesson completion stays empty', async () => {
  const { input, key, raw } = fixture();
  const result = await loadGuestDashboard(input);
  expect(result.records.events).toHaveLength(16);
  expect(
    result.records.events.every((event) => event.contentVersion === archivedAsset.contentVersion),
  ).toBe(true);
  expect(result.records.lessonFinals).toHaveLength(1);
  expect(result.records.lessonFinals[0]).toMatchObject({ score: 12, passed: true });
  expect(result.records.excludedRecords).toBe(0);
  expect(result.lessons).toHaveLength(12);
  expect(result.lessons[0].summary).toMatchObject({
    contentVersion: lessonAsset.contentVersion,
    passedAt: null,
    completedSlides: 0,
    latestScore: null,
  });
  expect(input.storage.getItem(key)).toBe(raw);
});

test('unknown edition remains disclosed and retained beside recognized archived answers', async () => {
  const { input } = fixture();
  const key = `${guestLessonPrefix}${archivedAsset.unit.id}.${'f'.repeat(64)}`;
  input.storage.setItem(key, '{future-source');
  const result = await loadGuestDashboard(input);
  expect(result.records.events).toHaveLength(16);
  expect(result.records.excludedRecords).toBe(1);
  expect(input.storage.getItem(key)).toBe('{future-source');
});

test('archive transport failure is visible and does not discard a valid archived source', async () => {
  const { input, key, raw } = fixture();
  input.assets.editions = async () => {
    throw new TypeError('archive offline');
  };
  await expect(loadGuestDashboard(input)).rejects.toThrow('archive offline');
  expect(input.storage.getItem(key)).toBe(raw);
});
