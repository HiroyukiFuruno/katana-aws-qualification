import { expect, test } from 'bun:test';
import { aggregateDashboard } from '../src/dashboard/aggregate';
import { createMemberDashboard } from '../src/dashboard/memberRepository';
import { dashboardDefaults } from '../src/dashboard/preferences';
import { ProgressApiError } from '../src/progress/api';
import type { ProgressRpcClient } from '../src/progress/types';
import { query, records } from './dashboard-fixture';
import { dashboardServicesFixture } from './dashboard-services-fixture';

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function fixture() {
  let generation = 0;
  let initializations = 0;
  let summaries = 0;
  let writes = 0;
  const started = deferred<void>();
  const release = deferred<void>();
  let held: 'summary' | 'save' = 'summary';
  const client: ProgressRpcClient = {
    async rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
      if (name === 'initialize_learning_state') {
        initializations++;
        return generation as T;
      }
      if (args.p_expected_generation !== generation) throw new ProgressApiError(409, 'PT409');
      if (name === 'dashboard_summary') {
        const captured = generation;
        summaries++;
        if (held === 'summary' && summaries === 1) {
          started.resolve();
          await release.promise;
        }
        return aggregateDashboard(captured === 0 ? records : { ...records, events: [] }, query) as T;
      }
      if (name === 'save_dashboard_settings') {
        writes++;
        if (held === 'save') {
          started.resolve();
          await release.promise;
        }
        return { revision: 1, settings: args.p_settings } as T;
      }
      return { revision: 0, settings: null } as T;
    },
    async select() {
      throw new Error('No raw data reads');
    },
  };
  const services = dashboardServicesFixture(client);
  return {
    services,
    client,
    started,
    release,
    reset: () => {
      generation++;
    },
    holdWrite: () => {
      held = 'save';
    },
    counts: () => ({ initializations, summaries, writes }),
  };
}

test('late old-generation success retries a read under the refreshed generation', async () => {
  const f = fixture();
  await f.services.settings();
  const stale = f.services.summary(query);
  await f.started.promise;
  f.reset();
  expect((await f.services.summary(query)).summary.total.answered).toBe(0);
  f.release.resolve();
  expect((await stale).summary.total.answered).toBe(0);
  expect(f.counts()).toEqual({ initializations: 2, summaries: 3, writes: 0 });
});

test('simultaneous generation conflicts share one recovery initialization', async () => {
  const f = fixture();
  await f.services.settings();
  f.reset();
  await Promise.all([f.services.settings(), f.services.settings(), f.services.settings()]);
  expect(f.counts().initializations).toBe(2);
});

test('a successful write from an old generation is rejected and never replayed', async () => {
  const f = fixture();
  await f.services.settings();
  f.holdWrite();
  const stale = f.services.save(dashboardDefaults('UTC'), 0);
  const outcome = stale.then(
    () => null,
    (error: unknown) => error,
  );
  await f.started.promise;
  f.reset();
  await f.services.settings();
  f.release.resolve();
  expect(await outcome).toBeInstanceOf(ProgressApiError);
  expect(f.counts().writes).toBe(1);
});

test('concurrent repository initialization shares the same generation request', async () => {
  const f = fixture();
  const repository = createMemberDashboard(f.client, () => true);
  await Promise.all([repository.initialize(), repository.initialize(), repository.initialize()]);
  expect(f.counts().initializations).toBe(1);
});

test('generation recovery invalidates already published widget scopes exactly once', async () => {
  const f = fixture();
  const observed: number[] = [];
  const unsubscribe = f.services.subscribe(() => observed.push(f.services.getSnapshot()));
  await f.services.settings();
  f.release.resolve();
  expect((await f.services.summary(query)).summary.total.answered).toBe(6);
  expect(observed).toEqual([]);
  f.reset();
  await Promise.all([f.services.settings(), f.services.settings()]);
  expect(observed).toEqual([1]);
  expect((await f.services.summary(query)).summary.total.answered).toBe(0);
  unsubscribe();
  f.reset();
  await f.services.settings();
  expect(observed).toEqual([1]);
});
