import { expect, test } from 'bun:test';
import type { Attempt } from '../src/attempts';
import { createGuestProgressRepository, setGuestProgressConsent } from '../src/progress';
import { createProgressStore } from '../src/progress';

function storage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => void values.delete(key),
    setItem: (key: string, value: string) => void values.set(key, value),
  };
}

const learningAttempt: Attempt = {
  schemaVersion: 1,
  questionId: 'old',
  questionRevision: 1,
  category: 'storage',
  sourceVersion: 'test',
  answeredAt: '2026-11-20T00:00:00.000Z',
  selected: ['A'],
  correct: ['A'],
  isCorrect: true,
  durationMs: 100,
  attemptNumber: 1,
  priorIncorrectCount: 0,
  mode: 'study',
  reviewCorrect: null,
  reward: 1,
};

test('consent grants merge pending history with disk without deduplicating valid repeated rows', () => {
  const local = storage();
  local.setItem('history', JSON.stringify([{ id: 1 }]));
  const repo = createGuestProgressRepository({ kind: 'guest', generation: 1 }, local, {
    isCurrent: () => true,
  });
  expect(repo.write('history', JSON.stringify([{ id: 2 }, { id: 2 }]))).toBe('blocked');
  expect(local.getItem('history')).toBe(JSON.stringify([{ id: 1 }]));
  setGuestProgressConsent(local, true);
  expect(repo.write('history', JSON.stringify([{ id: 2 }, { id: 2 }]))).toBe('saved');
  expect(JSON.parse(local.getItem('history') ?? '')).toEqual([{ id: 1 }, { id: 2 }, { id: 2 }]);
});

test('a failed granted write retains the in-memory source', () => {
  const local = storage();
  const repo = createGuestProgressRepository({ kind: 'guest', generation: 1 }, local, {
    isCurrent: () => true,
  });
  repo.write('profile', '{"earned":["a"]}');
  setGuestProgressConsent(local, true);
  local.setItem = () => {
    throw new Error('blocked');
  };
  expect(repo.write('profile', '{"earned":["b"]}')).toBe('failed');
  expect(repo.read('profile')).toBe('{"earned":["a"]}');
});

test('consent persists the latest history snapshot after an in-memory update', () => {
  const local = storage();
  const repo = createGuestProgressRepository({ kind: 'guest', generation: 1 }, local, {
    isCurrent: () => true,
  });
  expect(repo.write('history', JSON.stringify([{ id: 'a' }]))).toBe('blocked');
  setGuestProgressConsent(local, true);
  expect(repo.write('history', JSON.stringify([{ id: 'a' }, { id: 'b' }]))).toBe('saved');
  expect(JSON.parse(local.getItem('history') ?? '')).toEqual([{ id: 'a' }, { id: 'b' }]);
});

test('consent persists the latest profile snapshot after an in-memory update', () => {
  const local = storage();
  const repo = createGuestProgressRepository({ kind: 'guest', generation: 1 }, local, {
    isCurrent: () => true,
  });
  expect(repo.write('profile', '{"earned":["a"],"answers":{"q":1}}')).toBe('blocked');
  setGuestProgressConsent(local, true);
  expect(repo.write('profile', '{"earned":["b"],"answers":{"q":2}}')).toBe('saved');
  expect(local.getItem('profile')).toBe('{"earned":["b"],"answers":{"q":2}}');
});

test('a granted guest can replace a valid profile after an earlier profile save', () => {
  const local = storage();
  setGuestProgressConsent(local, true);
  const repo = createGuestProgressRepository({ kind: 'guest', generation: 1 }, local, {
    isCurrent: () => true,
  });
  expect(repo.write('profile', '{"earned":["saa-c03"],"answers":{"q-1":1}}')).toBe('saved');
  expect(repo.write('profile', '{"earned":[],"answers":{"q-1":2}}')).toBe('saved');
  expect(local.getItem('profile')).toBe('{"earned":[],"answers":{"q-1":2}}');
});

test('a corrupt profile is retained instead of being overwritten', () => {
  const local = storage();
  setGuestProgressConsent(local, true);
  local.setItem('profile', '{"earned":"not-an-array"}');
  const repo = createGuestProgressRepository({ kind: 'guest', generation: 1 }, local, {
    isCurrent: () => true,
  });
  expect(repo.write('profile', '{"earned":[],"answers":{}}')).toBe('failed');
  expect(local.getItem('profile')).toBe('{"earned":"not-an-array"}');
});

test('a corrupt persisted value is retained when an append cannot safely merge it', () => {
  const local = storage();
  setGuestProgressConsent(local, true);
  local.setItem('history', '{bad json');
  const repo = createGuestProgressRepository({ kind: 'guest', generation: 1 }, local, {
    isCurrent: () => true,
  });
  expect(repo.write('history', JSON.stringify([{ id: 1 }]))).toBe('failed');
  expect(local.getItem('history')).toBe('{bad json');
});

test('guest append refreshes the UI from the merged disk snapshot after consent changes', async () => {
  const local = storage();
  local.setItem('katana.learning-progress-consent.v1', 'denied');
  local.setItem('saa-study.attempts.v1', JSON.stringify([learningAttempt]));
  const store = createProgressStore({
    isCurrent: () => true,
    owner: { kind: 'guest', generation: 1 },
    storage: local,
  });
  await store.initialize();
  await store.appendAttempt('saa-c03', { ...learningAttempt, questionId: 'a' });
  setGuestProgressConsent(local, true);
  await store.initialize();
  await store.appendAttempt('saa-c03', { ...learningAttempt, questionId: 'b' });
  await store.appendAttempt('saa-c03', { ...learningAttempt, questionId: 'c' });
  const ids = store.getSnapshot().attempts.map((item) => item.questionId);
  expect(ids).toEqual(['old', 'a', 'b', 'c']);
  expect(JSON.parse(local.getItem('saa-study.attempts.v1') ?? '')).toHaveLength(4);
});
