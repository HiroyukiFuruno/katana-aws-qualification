import { expect, test } from 'bun:test';
import { ProgressCoordinator } from '../src/progress/ProgressCoordinator';
import {
  account,
  api,
  authFixture,
  configuration,
  storage,
  waitForOwner,
} from './progress-coordinator-transition-fixture';

test('A to B to A ignores a stale delayed cleanup transition', async () => {
  const restoreFetch = api();
  const source = authFixture();
  const original = globalThis.navigator;
  let requestCount = 0;
  let cleanupStarted: (() => void) | undefined;
  let releaseClear: (() => void) | undefined;
  const tails = new Map<string, Promise<void>>();
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      locks: {
        request: <T>(name: string, action: () => Promise<T>) => {
          const previous = tails.get(name) ?? Promise.resolve();
          const run = previous.then(async () => {
            requestCount += 1;
            if (requestCount === 2) {
              cleanupStarted?.();
              await new Promise<void>((resolve) => {
                releaseClear = resolve;
              });
            }
            return action();
          });
          tails.set(
            name,
            run.then(
              () => undefined,
              () => undefined,
            ),
          );
          return run as Promise<T>;
        },
      },
    },
  });
  const stopAuth = source.authStore.start();
  const coordinator = new ProgressCoordinator(source.authStore, configuration, storage());
  const stop = coordinator.start();
  try {
    source.emit(account('member-a'));
    await waitForOwner(coordinator, 'member-a');
    source.emit(account('member-b'));
    await new Promise<void>((resolve) => {
      cleanupStarted = resolve;
    });
    source.emit(account('member-a'));
    releaseClear?.();
    await waitForOwner(coordinator, 'member-a');
    expect(coordinator.getSnapshot().store?.getSnapshot().owner).toMatchObject({
      kind: 'member',
      userId: 'member-a',
    });
  } finally {
    stop();
    stopAuth();
    restoreFetch();
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: original });
  }
});

test('stop invalidates a pending cleanup before its lock is released', async () => {
  const restoreFetch = api();
  const source = authFixture();
  const original = globalThis.navigator;
  let started: (() => void) | undefined;
  let release: (() => void) | undefined;
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      locks: {
        request: <T>(_name: string, action: () => Promise<T>) => {
          started?.();
          return new Promise<T>((resolve, reject) => {
            release = () => action().then(resolve, reject);
          });
        },
      },
    },
  });
  const stopAuth = source.authStore.start();
  const coordinator = new ProgressCoordinator(source.authStore, configuration, storage());
  const stop = coordinator.start();
  try {
    source.emit(account('member-a'));
    await new Promise<void>((resolve) => {
      started = resolve;
    });
    stop();
    release?.();
    await Promise.resolve();
    await Promise.resolve();
    expect(coordinator.getSnapshot()).toEqual({ status: 'loading', store: null });
  } finally {
    stopAuth();
    restoreFetch();
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: original });
  }
});
