import { query } from '../../scripts/dashboard-fixture';
import type { DashboardPreferences } from '../../src/dashboard/preferenceTypes';
import { createDashboardServices } from '../../src/dashboard/services';
import { createLessonAssets } from '../../src/fundamentals/delivery/assets';
import { ProgressApiError } from '../../src/progress/api';
import { createQuestionResolver } from '../../src/progress/questionCatalog';
import { createProgressStore } from '../../src/progress/store';
import type { ProgressRpcClient } from '../../src/progress/types';
import { type AuthSession, request } from './rest-client';

type Counts = { saves: number };

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

function code(value: unknown) {
  return value && typeof value === 'object' && 'code' in value && typeof value.code === 'string'
    ? value.code
    : null;
}

export function dashboardRestClient(session: AuthSession, counts?: Counts): ProgressRpcClient {
  return {
    async rpc<T>(name: string, args: Record<string, unknown>) {
      if (name === 'save_dashboard_settings' && counts) counts.saves++;
      const response = await request(`/rpc/${name}`, {
        token: session.access_token,
        method: 'POST',
        body: args,
      });
      const body: unknown = await response.json();
      if (!response.ok) throw new ProgressApiError(response.status, code(body));
      return body as T;
    },
    async select() {
      throw new Error('Dashboard recovery must not read raw tables.');
    },
  };
}

async function reset(control: ProgressRpcClient, generation: number) {
  await control.rpc('reset_my_learning_data', { p_expected_generation: generation });
}

export async function verifyDashboardSettingsRecovery(
  session: AuthSession,
  settings: DashboardPreferences,
) {
  const counts = { saves: 0 };
  const owner = { kind: 'member' as const, generation: 0, userId: session.user.id };
  const dashboardClient = dashboardRestClient(session, counts);
  const store = createProgressStore({
    client: dashboardClient,
    isCurrent: () => true,
    owner,
    storage: storage(),
  });
  const services = createDashboardServices({
    store,
    client: dashboardClient,
    isCurrent: () => true,
    storage: storage(),
    assets: createLessonAssets(),
    resolve: createQuestionResolver(),
    locale: 'en',
  });
  const control = dashboardRestClient(session);
  if ((await services.settings()).revision !== 1)
    throw new Error('Dashboard settings did not start at revision 1.');

  await reset(control, 1);
  if ((await services.settings()).revision !== 1)
    throw new Error('Readonly settings did not recover after generation reset.');

  await reset(control, 2);
  if ((await services.summary(query)).summary.total.answered !== 0)
    throw new Error('Readonly dashboard summary did not recover after generation reset.');

  await reset(control, 3);
  try {
    await services.save(settings, 1);
    throw new Error('Stale dashboard settings write unexpectedly succeeded.');
  } catch (error) {
    if (!(error instanceof ProgressApiError) || error.code !== 'PT409') throw error;
  }
  if (counts.saves !== 1) throw new Error('Stale dashboard settings write was replayed.');
  const canonical = await control.rpc<{ revision: number }>('load_dashboard_settings', {
    p_expected_generation: 4,
  });
  if (canonical.revision !== 1) throw new Error('Stale dashboard settings write changed the revision.');
  if ((await services.settings()).revision !== 1)
    throw new Error('Readonly settings did not recover after stale write rejection.');
}
