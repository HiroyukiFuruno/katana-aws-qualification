import { expect, test } from 'bun:test';
import { historyKey } from '../src/history';
import { createProgressStore, setGuestProgressConsent } from '../src/progress';
import { memberAttempt, memoryStorage } from './progress-store-fixture';

const owner = { generation: 1, kind: 'guest' as const };
const examKey = 'katana.certification-exam.v1.saa-c03';
const wrong = (stamp: string) => ({
  ...memberAttempt,
  answeredAt: stamp,
  isCorrect: false,
  questionId: 'same',
  reward: 0,
  selected: ['wrong'],
});
const draft = {
  deadline: 1_800_000_000_000,
  id: '00000000-0000-0000-0000-000000000001',
  order: ['["exam",1]'],
  position: 0,
  responses: { '["exam",1]': { durationMs: 1, flagged: false, selected: ['a'] } },
};

function store(storage: ReturnType<typeof memoryStorage>) {
  return createProgressStore({ isCurrent: () => true, owner, storage });
}

async function append(next: ReturnType<typeof store>, stamp: string) {
  return next.appendAttempt('saa-c03', wrong(stamp), (attempts) => {
    const same = attempts.filter((attempt) => attempt.questionId === 'same');
    return { ...wrong(stamp), attemptNumber: same.length + 1, priorIncorrectCount: same.length };
  });
}

test('grant reconciles disk and memory before deriving the next same-question metadata', async () => {
  const local = memoryStorage();
  const disk = wrong('2026-11-20T00:00:00.000Z');
  local.setItem(historyKey, JSON.stringify([disk]));
  const next = store(local);
  await next.initialize();
  await append(next, '2026-11-20T00:01:00.000Z');
  setGuestProgressConsent(local, true);
  await next.initialize();
  expect(next.getSnapshot().attempts).toHaveLength(2);
  const saved = await append(next, '2026-11-20T00:02:00.000Z');
  expect(saved).toMatchObject({ attemptNumber: 3, priorIncorrectCount: 2 });
  expect(JSON.parse(local.getItem(historyKey) ?? '')).toHaveLength(3);
  const reloaded = store(local);
  await reloaded.initialize();
  expect(reloaded.getSnapshot().attempts).toHaveLength(3);
});

test('equal disk and offline rows remain separate and a stale tab does not duplicate their base', async () => {
  const local = memoryStorage();
  const same = wrong('2026-11-20T00:00:00.000Z');
  local.setItem(historyKey, JSON.stringify([same]));
  const next = store(local);
  await next.initialize();
  await next.appendAttempt('saa-c03', same);
  setGuestProgressConsent(local, true);
  await next.initialize();
  expect(next.getSnapshot().attempts).toEqual([same, same]);

  setGuestProgressConsent(local, false);
  const pending = store(local);
  await pending.initialize();
  await append(pending, '2026-11-20T00:01:00.000Z');
  setGuestProgressConsent(local, true);
  local.setItem(historyKey, JSON.stringify([same, wrong('2026-11-20T00:00:30.000Z')]));
  await append(pending, '2026-11-20T00:02:00.000Z');
  expect(JSON.parse(local.getItem(historyKey) ?? '')).toHaveLength(4);
});

test('grant flushes pending profile and exam state, while corruption and denied consent preserve raw storage', async () => {
  const local = memoryStorage();
  const next = store(local);
  await next.initialize();
  await next.replaceProfile({ answers: { q: 1 }, earned: ['saa-c03'] });
  await next.saveGuestExam(examKey, draft);
  setGuestProgressConsent(local, true);
  await next.initialize();
  const reloaded = store(local);
  await reloaded.initialize();
  expect(reloaded.getSnapshot().profile).toEqual({ answers: { q: 1 }, earned: ['saa-c03'] });
  expect(reloaded.readGuestExam(examKey)).toEqual(draft);

  const corrupt = memoryStorage();
  corrupt.setItem(historyKey, '{bad json');
  const denied = store(corrupt);
  await denied.initialize();
  setGuestProgressConsent(corrupt, true);
  await denied.initialize();
  expect(denied.getSnapshot().corruptRows).toBe(1);
  expect(corrupt.getItem(historyKey)).toBe('{bad json');

  let diskReads = 0;
  const unread = memoryStorage();
  unread.setItem(historyKey, JSON.stringify([wrong('2026-11-20T00:00:00.000Z')]));
  const guarded = {
    ...unread,
    getItem: (key: string) => {
      if (key === historyKey) diskReads++;
      return unread.getItem(key);
    },
  };
  const noConsent = createProgressStore({ isCurrent: () => true, owner, storage: guarded });
  await noConsent.initialize();
  expect(diskReads).toBe(0);
  expect(noConsent.guestStorageConflicts()).toEqual([]);
});

test('different persisted profile is not silently replaced by offline memory', async () => {
  const local = memoryStorage();
  local.setItem('katana.certification-profile.v1', JSON.stringify({ answers: { old: 1 }, earned: [] }));
  const next = store(local);
  await next.initialize();
  await next.replaceProfile({ answers: { new: 1 }, earned: ['saa-c03'] });
  setGuestProgressConsent(local, true);
  await next.initialize();
  expect(next.getSnapshot().error).toBe('load');
  expect(local.getItem('katana.certification-profile.v1')).toContain('old');
  expect(next.guestStorageConflicts()).toEqual([
    { key: 'katana.certification-profile.v1', kind: 'profile' },
  ]);
  await next.resolveGuestStorageConflict('katana.certification-profile.v1', 'stored');
  expect(next.getSnapshot().profile).toEqual({ answers: { old: 1 }, earned: [] });

  setGuestProgressConsent(local, false);
  await next.replaceProfile({ answers: { pending: 1 }, earned: ['saa-c03'] });
  setGuestProgressConsent(local, true);
  await next.initialize();
  await next.resolveGuestStorageConflict('katana.certification-profile.v1', 'pending');
  const reloaded = store(local);
  await reloaded.initialize();
  expect(reloaded.getSnapshot().profile).toEqual({ answers: { pending: 1 }, earned: ['saa-c03'] });
});

test('member stores expose no guest conflicts and reject their resolution', async () => {
  const member = createProgressStore({
    client: { rpc: async () => 1, select: async () => [] },
    isCurrent: () => true,
    owner: { generation: 1, kind: 'member', userId: 'member' },
    storage: memoryStorage(),
  });
  expect(member.guestStorageConflicts()).toEqual([]);
  await expect(member.resolveGuestStorageConflict('key', 'stored')).rejects.toThrow();
});
