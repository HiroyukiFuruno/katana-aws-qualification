import { expect, test } from 'bun:test';
import { aggregateDashboard } from '../src/dashboard/aggregate';
import { createDashboardServices } from '../src/dashboard/services';
import { ProgressApiError } from '../src/progress/api';
import { createProgressStore } from '../src/progress/store';
import type { ProgressRpcClient } from '../src/progress/types';
import { query, records } from './dashboard-fixture';
import { memoryStorage } from './memory-storage.fixture';

test('cross-tab reset refreshes read generation once but never automatically replays settings writes', async () => {
  let generation = 0;
  let initializations = 0;
  let writes = 0;
  const client: ProgressRpcClient = {
    async rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
      if (name === 'initialize_learning_state') {
        initializations++;
        return generation as T;
      }
      if (name === 'save_dashboard_settings') writes++;
      if (args.p_expected_generation !== generation) throw new ProgressApiError(409, 'PT409');
      if (name === 'dashboard_summary') return aggregateDashboard(records, query) as T;
      return { revision: 0, settings: null } as T;
    },
    async select() {
      throw new Error('Raw table reads are not allowed.');
    },
  };
  const storage = memoryStorage();
  const store = createProgressStore({
    owner: { kind: 'member', userId: '11111111-1111-4111-8111-111111111111', generation: 0 },
    client,
    storage,
    isCurrent: () => true,
  });
  const services = createDashboardServices({
    store,
    client,
    storage,
    isCurrent: () => true,
    locale: 'ja',
    assets: {
      index: async () => {
        throw new Error('Not needed');
      },
      unit: async () => {
        throw new Error('Not needed');
      },
    },
    resolve: async () => undefined,
  });
  await services.settings();
  expect(initializations).toBe(1);
  generation++;
  await services.settings();
  expect(initializations).toBe(2);
  generation++;
  expect((await services.summary(query)).summary.total.answered).toBe(6);
  expect(initializations).toBe(3);
  generation++;
  const { dashboardDefaults } = await import('../src/dashboard/preferences');
  await expect(services.save(dashboardDefaults('UTC'), 0)).rejects.toBeInstanceOf(ProgressApiError);
  expect(writes).toBe(1);
  expect(initializations).toBe(3);
});
