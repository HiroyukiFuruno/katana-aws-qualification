import { expect, test } from 'bun:test';
import { RoadmapProfileSaveGuard } from '../src/roadmapProfileSaveGuard';

test('profile saves reject a concurrent action until the first save resolves', async () => {
  let release: (() => void) | undefined;
  let calls = 0;
  const states: boolean[] = [];
  const guard = new RoadmapProfileSaveGuard();
  const first = guard.run(
    () =>
      new Promise<void>((resolve) => {
        calls += 1;
        release = resolve;
      }),
    (saving) => states.push(saving),
  );
  const skipped = await guard.run(
    async () => {
      calls += 1;
    },
    (saving) => states.push(saving),
  );
  expect(calls).toBe(1);
  expect(skipped.accepted).toBe(false);
  expect(guard.pending).toBe(true);
  release?.();
  await first;
  expect(guard.pending).toBe(false);
  expect(states).toEqual([true, false]);
});

test('a completed void save is accepted for the guest profile path', async () => {
  const guard = new RoadmapProfileSaveGuard();
  const saved = await guard.run(
    async () => undefined,
    () => {},
  );
  expect(saved).toEqual({ accepted: true, current: true, value: undefined });
});

test('owner replacement invalidates the older save without clearing the new pending state', async () => {
  let releaseFirst: (() => void) | undefined;
  let releaseSecond: (() => void) | undefined;
  const states: boolean[] = [];
  const guard = new RoadmapProfileSaveGuard();
  const first = guard.run(
    () =>
      new Promise<void>((resolve) => {
        releaseFirst = resolve;
      }),
    (saving) => states.push(saving),
  );
  guard.invalidate('member:2:user', {}, (saving) => states.push(saving));
  const second = guard.run(
    () =>
      new Promise<void>((resolve) => {
        releaseSecond = resolve;
      }),
    (saving) => states.push(saving),
  );
  releaseFirst?.();
  expect((await first).current).toBe(false);
  expect(guard.pending).toBe(true);
  releaseSecond?.();
  expect((await second).current).toBe(true);
  expect(states).toEqual([true, false, true, false]);
});
