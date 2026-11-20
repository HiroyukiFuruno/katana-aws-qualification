import { expect, test } from 'bun:test';
import { profileKey } from '../src/assessment';
import { createProgressStore, setGuestProgressConsent } from '../src/progress';
import { memoryStorage } from './progress-store-fixture';

const owner = { generation: 1, kind: 'guest' as const };
const examKey = 'katana.certification-exam.v1.saa-c03';
const storedProfile = { answers: { stored: 1 }, earned: [] };
const pendingProfile = { answers: { pending: 1 }, earned: ['saa-c03'] };
const nextProfile = { answers: { next: 1 }, earned: ['saa-c03'] };

function draft(position: number) {
  return {
    deadline: 1_800_000_000_000,
    id: '00000000-0000-0000-0000-000000000001',
    order: ['["exam",1]', '["exam",2]', '["exam",3]'],
    position,
    responses: { '["exam",1]': { durationMs: 1, flagged: false, selected: ['a'] } },
  };
}

function store(storage: ReturnType<typeof memoryStorage>) {
  return createProgressStore({ isCurrent: () => true, owner, storage });
}

test('profile save preserves an unresolved pending conflict until the explicit choice', async () => {
  const local = memoryStorage();
  local.setItem(profileKey, JSON.stringify(storedProfile));
  const next = store(local);
  await next.initialize();
  await next.replaceProfile(pendingProfile);
  setGuestProgressConsent(local, true);
  await next.initialize();

  await expect(next.replaceProfile(nextProfile)).rejects.toThrow('Guest profile was not saved.');
  expect(JSON.parse(local.getItem(profileKey) ?? '')).toEqual(storedProfile);
  expect(next.guestStorageConflicts()).toEqual([{ key: profileKey, kind: 'profile' }]);

  await next.resolveGuestStorageConflict(profileKey, 'pending');
  await next.replaceProfile(nextProfile);
  expect(JSON.parse(local.getItem(profileKey) ?? '')).toEqual(nextProfile);
});

test('exam save preserves an unresolved pending conflict until the explicit choice', async () => {
  const local = memoryStorage();
  local.setItem(examKey, JSON.stringify(draft(0)));
  const next = store(local);
  await next.initialize();
  await next.saveGuestExam(examKey, draft(1));
  setGuestProgressConsent(local, true);
  await next.initialize();

  await expect(next.saveGuestExam(examKey, draft(2))).rejects.toThrow('Guest exam draft was not saved.');
  expect(JSON.parse(local.getItem(examKey) ?? '')).toEqual(draft(0));
  expect(next.guestStorageConflicts()).toEqual([{ key: examKey, kind: 'exam' }]);

  await next.resolveGuestStorageConflict(examKey, 'pending');
  await next.saveGuestExam(examKey, draft(2));
  expect(JSON.parse(local.getItem(examKey) ?? '')).toEqual(draft(2));
});
