import { expect, test } from 'bun:test';
import { createProgressStore, type ProgressRpcClient, setGuestProgressConsent } from '../src/progress';
import { memoryStorage } from './progress-store-fixture';

const historyKey = 'saa-study.attempts.v1';
const profileKey = 'katana.certification-profile.v1';
const indexKey = 'saa-study.incorrect.v1';
const legacyExamKey = 'saa-study.exam.v1';
const examKey = 'katana.certification-exam.v1.saa-c03';
const learningKeys = [historyKey, profileKey, indexKey, legacyExamKey, examKey];

function memberClient(): ProgressRpcClient {
  return {
    async rpc(name) {
      if (name === 'initialize_learning_state') return 1;
      if (name === 'load_roadmap_profile_snapshot_v2') return [];
      if (name === 'reset_my_learning_data') return 2;
      throw new Error(`unexpected rpc: ${name}`);
    },
    async select() {
      return [];
    },
  };
}

test('guest reset purges learning data after consent withdrawal without touching unrelated keys', async () => {
  const local = memoryStorage();
  setGuestProgressConsent(local, true);
  for (const key of learningKeys) local.setItem(key, JSON.stringify({ key }));
  local.setItem('katana-aws:analytics-consent', 'granted');
  local.setItem('katana-theme', 'dark');
  const guest = createProgressStore({
    isCurrent: () => true,
    owner: { kind: 'guest', generation: 1 },
    storage: local,
  });
  await guest.initialize();
  setGuestProgressConsent(local, false);
  await guest.reset();
  expect(learningKeys.map((key) => local.getItem(key))).toEqual([null, null, null, null, null]);
  expect(local.getItem('katana-aws:analytics-consent')).toBe('granted');
  expect(local.getItem('katana-theme')).toBe('dark');
  setGuestProgressConsent(local, true);
  const reloaded = createProgressStore({
    isCurrent: () => true,
    owner: { kind: 'guest', generation: 1 },
    storage: local,
  });
  await reloaded.initialize();
  expect(reloaded.getSnapshot().attempts).toEqual([]);
  expect(reloaded.readGuestExam(examKey)).toBeUndefined();
});

test('member reset leaves guest learning records untouched', async () => {
  const local = memoryStorage();
  for (const key of learningKeys) local.setItem(key, JSON.stringify({ key }));
  const member = createProgressStore({
    client: memberClient(),
    isCurrent: () => true,
    owner: { kind: 'member', generation: 1, userId: 'member-a' },
    storage: local,
  });
  await member.initialize();
  await member.reset();
  expect(learningKeys.map((key) => local.getItem(key))).toEqual(
    learningKeys.map((key) => JSON.stringify({ key })),
  );
});
