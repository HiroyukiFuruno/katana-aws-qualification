import { expect, test } from 'bun:test';
import { initialGuestLesson } from '../src/fundamentals/state/guestInitial';
import { recordGuestLessonStep } from '../src/fundamentals/state/guestStep';
import { GuestLessonStorage, guestLessonPrefix } from '../src/fundamentals/state/guestStorage';
import { setGuestProgressConsent } from '../src/progress/guest';
import { clearGuestLearningMemory } from '../src/progress/guestMemoryLifecycle';
import { lessonAsset as asset } from './fundamentals-state-fixture';
import { memoryStorage as storage } from './memory-storage.fixture';

const key = `${guestLessonPrefix}${asset.unit.id}.${asset.contentVersion}`;
const first = asset.steps[0];
if (!first) throw new Error('Missing fixture reading.');
const firstId = first.id;
const next = (source: ReturnType<typeof initialGuestLesson>) =>
  recordGuestLessonStep(source, asset, firstId).source;

test('denied guest reads no saved lesson and consent later requires an explicit conflict choice', async () => {
  const local = storage();
  const original = JSON.stringify(initialGuestLesson(asset));
  local.setItem(key, original);
  const read = local.getItem;
  const reads: string[] = [];
  local.getItem = (key) => {
    reads.push(key);
    return read(key);
  };
  const repo = new GuestLessonStorage(local, () => true);
  await repo.change(asset, next);
  expect(reads).not.toContain(key);
  expect(local.values.get(key)).toBe(original);
  setGuestProgressConsent(local, true);
  await expect(repo.read(asset)).rejects.toThrow('differ');
  expect(local.values.get(key)).toBe(original);
  expect((await repo.resolve(asset, 'pending')).completedSlideIds).toEqual([firstId]);
  expect((await new GuestLessonStorage(local, () => true).read(asset)).completedSlideIds).toEqual([
    firstId,
  ]);
});

test('granted guest reloads current source, preserves corrupt data and rejects stale owners', async () => {
  const local = storage();
  setGuestProgressConsent(local, true);
  let current = true;
  const repo = new GuestLessonStorage(local, () => current);
  await repo.change(asset, next);
  expect((await new GuestLessonStorage(local, () => true).read(asset)).furthestPlanPosition).toBe(1);
  local.setItem(key, '{invalid');
  await expect(repo.change(asset, next)).rejects.toThrow();
  expect(local.getItem(key)).toBe('{invalid');
  current = false;
  await expect(repo.read(asset)).rejects.toThrow('owner changed');
});

test('withdrawal preserves the saved source and reconsent flushes only an unchanged base', async () => {
  const local = storage();
  setGuestProgressConsent(local, true);
  const repo = new GuestLessonStorage(local, () => true);
  await repo.read(asset);
  setGuestProgressConsent(local, false);
  await repo.change(asset, next);
  expect(local.getItem(key)).toBeNull();
  setGuestProgressConsent(local, true);
  expect((await repo.read(asset)).furthestPlanPosition).toBe(1);
  const saved = local.getItem(key);
  setGuestProgressConsent(local, false);
  await repo.change(asset, (source) => source);
  expect(local.getItem(key)).toBe(saved);
  setGuestProgressConsent(local, true);
  expect((await repo.read(asset)).furthestPlanPosition).toBe(1);
});

test('guest reset clears transient lesson memory without reading denied disk records', async () => {
  const local = storage();
  const repo = new GuestLessonStorage(local, () => true);
  await repo.change(asset, next);
  clearGuestLearningMemory();
  expect((await repo.read(asset)).furthestPlanPosition).toBe(0);
  expect(local.getItem(key)).toBeNull();
  repo.dispose();
});

test('a guest write queued before reset cannot recreate the cleared lesson', async () => {
  const local = storage();
  setGuestProgressConsent(local, true);
  const repo = new GuestLessonStorage(local, () => true);
  const pending = repo.change(asset, next);
  clearGuestLearningMemory();
  await expect(pending).rejects.toThrow('was reset');
  expect(local.getItem(key)).toBeNull();
  expect((await repo.read(asset)).furthestPlanPosition).toBe(0);
  repo.dispose();
});
