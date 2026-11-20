import { expect, test } from 'bun:test';
import index from '../public/fundamentals/delivery/index.json';
import { makeAttempt } from '../src/attempts';
import { dashboardGuestAttempts } from '../src/dashboard/guestAttempts';
import { loadGuestDashboard } from '../src/dashboard/guestRecords';
import { initialGuestLesson } from '../src/fundamentals/state/guestInitial';
import { guestLessonPrefix } from '../src/learningStorage';
import { setGuestProgressConsent } from '../src/progress/guest';
import { lessonAsset } from './fundamentals-state-fixture';
import { memoryStorage } from './memory-storage.fixture';
import { examQuestion } from './progress-store-fixture';

const resolve = async () => ({ certificationId: 'saa-c03', question: examQuestion });
test('guest attempts use trusted metadata, stable occurrence identities and no invented submission time', async () => {
  const attempt = makeAttempt([], examQuestion, ['a'], 'study', 0, '2026-11-20T10:00:00Z');
  const exam = makeAttempt([], examQuestion, ['a'], 'exam', 300, '2026-11-20T11:00:00Z', 'old-exam');
  const result = await dashboardGuestAttempts(
    [
      attempt,
      { ...attempt },
      exam,
      { ...attempt, sourceVersion: 'forged' },
      { ...attempt, isCorrect: false },
    ],
    resolve,
  );
  expect(result.events).toHaveLength(3);
  expect(new Set(result.events.map((event) => event.eventId)).size).toBe(3);
  expect(result.excludedRecords).toBe(2);
  expect(result.exams[0]).toMatchObject({
    startedAt: null,
    submittedAt: null,
    questionCount: null,
    lastAnsweredAt: exam.answeredAt,
  });
  expect(result.events[0].polarity).toBe('unspecified');
  expect(result.events[0].durationMs).toBe(0);
});

test('guest catalog transport errors remain errors instead of excluding valid records', async () => {
  const attempt = makeAttempt([], examQuestion, ['a'], 'study', 0, '2026-11-20T10:00:00Z');
  await expect(
    dashboardGuestAttempts([attempt], async () => {
      throw new TypeError('offline');
    }),
  ).rejects.toThrow('offline');
});

test('denied guest dashboard does not read stored lesson data or fetch catalogs', async () => {
  const storage = memoryStorage();
  const reads: string[] = [];
  const original = storage.getItem;
  storage.getItem = (key) => {
    reads.push(key);
    return original(key);
  };
  let requests = 0;
  await expect(
    loadGuestDashboard({
      storage,
      attempts: [],
      corruptRows: 0,
      resolve,
      locale: 'ja',
      isCurrent: () => true,
      assets: {
        index: async () => {
          requests++;
          return index;
        },
        unit: async () => lessonAsset,
      },
    }),
  ).rejects.toThrow();
  expect(requests).toBe(0);
  expect(reads).not.toContain(
    `${guestLessonPrefix}${lessonAsset.unit.id}.${lessonAsset.contentVersion}`,
  );
});

test('current lesson progress uses validated source; corrupt records are retained and disclosed', async () => {
  const storage = memoryStorage();
  setGuestProgressConsent(storage, true);
  const key = `${guestLessonPrefix}${lessonAsset.unit.id}.${lessonAsset.contentVersion}`;
  storage.setItem(key, JSON.stringify(initialGuestLesson(lessonAsset)));
  const input = {
    storage,
    attempts: [],
    corruptRows: 0,
    resolve,
    locale: 'ja' as const,
    isCurrent: () => true,
    assets: { index: async () => index, unit: async () => lessonAsset },
  };
  const first = await loadGuestDashboard(input);
  expect(first.lessons).toHaveLength(12);
  expect(first.records.events).toEqual([]);
  expect(first.lessons[0].summary.totalSlides).toBe(27);
  storage.setItem(key, '{broken');
  const second = await loadGuestDashboard(input);
  expect(second.records.excludedRecords).toBe(1);
  expect(second.lessons).toHaveLength(11);
  expect(storage.getItem(key)).toBe('{broken');
});
