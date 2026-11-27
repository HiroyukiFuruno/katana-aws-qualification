import { createDashboardServices } from '../src/dashboard/services';
import { createProgressStore } from '../src/progress/store';
import type { ProgressRpcClient } from '../src/progress/types';
import { memoryStorage } from './memory-storage.fixture';

export function dashboardServicesFixture(client: ProgressRpcClient) {
  const storage = memoryStorage();
  const store = createProgressStore({
    owner: { kind: 'member', userId: '11111111-1111-4111-8111-111111111111', generation: 0 },
    client,
    storage,
    isCurrent: () => true,
  });
  return createDashboardServices({
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
      record: async () => {
        throw new Error('Not needed');
      },
    },
    resolve: async () => undefined,
  });
}
