import { expect, test } from 'bun:test';
import { dashboardLessonSyncStatus } from '../src/dashboard/pending';
import { lessonOutboxKey } from '../src/fundamentals/state/outboxCodec';
import { memoryStorage } from './memory-storage.fixture';

const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const key = lessonOutboxKey(owner);
const command = {
  commandId: '33333333-3333-4333-8333-333333333333',
  contentVersion: 'v1',
  unitId: 'fundamentals.cloud-concepts',
  kind: 'startFinal',
  input: { expectedRevision: 0, sessionId: '44444444-4444-4444-8444-444444444444' },
};

test('dashboard only reports its current owner generation and never rewrites pending work', () => {
  const storage = memoryStorage();
  expect(dashboardLessonSyncStatus(storage, owner, 2)).toEqual({ pending: false, unreadable: false });
  for (const [generation, pending, unreadable] of [
    [1, false, false],
    [2, true, false],
    [3, false, true],
  ] as const) {
    const raw = JSON.stringify({ userId: owner, generation, version: 1, commands: [command] });
    storage.setItem(key, raw);
    expect(dashboardLessonSyncStatus(storage, owner, 2)).toEqual({ pending, unreadable });
    expect(storage.getItem(key)).toBe(raw);
    expect(dashboardLessonSyncStatus(storage, other, 2)).toEqual({ pending: false, unreadable: false });
  }
});

test('corrupt, wrong-owner and duplicate pending commands remain intact with an explicit unreadable status', () => {
  const storage = memoryStorage();
  for (const raw of [
    '{',
    JSON.stringify({ userId: other, generation: 2, version: 1, commands: [command] }),
    JSON.stringify({ userId: owner, generation: 2, version: 1, commands: [command, command] }),
  ]) {
    storage.setItem(key, raw);
    expect(dashboardLessonSyncStatus(storage, owner, 2)).toEqual({ pending: false, unreadable: true });
    expect(storage.getItem(key)).toBe(raw);
  }
  expect(
    dashboardLessonSyncStatus(
      {
        getItem() {
          throw new Error('Storage blocked');
        },
        setItem() {},
        removeItem() {},
      },
      owner,
      2,
    ),
  ).toEqual({ pending: false, unreadable: true });
});
