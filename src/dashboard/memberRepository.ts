import type { LessonAssets } from '../fundamentals/delivery/assets';
import { readLessonSummaries } from '../fundamentals/state/memberSummary';
import { type Locale, localePath } from '../locales';
import { ProgressApiError } from '../progress/api';
import { assertCurrentProgressOwner, type ProgressRpcClient } from '../progress/types';
import { dashboardNumber } from './codec';
import { readDashboardPreferences } from './preferenceCodec';
import type { DashboardPreferences } from './preferenceTypes';
import type { DashboardQuery } from './queryTypes';
import { readDashboardSettings } from './settingsCodec';
import { readDashboardSummary } from './summaryCodec';

export function createMemberDashboard(client: ProgressRpcClient, isCurrent: () => boolean) {
  let generation: number | undefined;
  let epoch = 0;
  let initialization: Promise<number> | undefined;
  const current = () => assertCurrentProgressOwner({ isCurrent });
  async function request(name: string, args: Record<string, unknown>) {
    current();
    if (generation === undefined) {
      if (epoch > 0) throw new ProgressApiError(409, 'PT409');
      throw new Error('Dashboard repository is not ready.');
    }
    const captured = { generation, epoch };
    const raw = await client.rpc<unknown>(name, { ...args, p_expected_generation: captured.generation });
    current();
    if (generation !== captured.generation || epoch !== captured.epoch)
      throw new ProgressApiError(409, 'PT409');
    return raw;
  }
  return {
    async initialize() {
      current();
      if (initialization) return initialization;
      const requested = ++epoch;
      generation = undefined;
      const pending = (async () => {
        const raw = await client.rpc<unknown>('initialize_learning_state', {});
        current();
        if (epoch !== requested) throw new ProgressApiError(409, 'PT409');
        generation = dashboardNumber(raw);
        return generation;
      })();
      initialization = pending;
      const clear = () => {
        if (initialization === pending) initialization = undefined;
      };
      void pending.then(clear, clear);
      return pending;
    },
    async settings() {
      return readDashboardSettings(await request('load_dashboard_settings', {}));
    },
    async save(settings: DashboardPreferences, revision: number) {
      const canonical = readDashboardPreferences(settings);
      const saved = readDashboardSettings(
        await request('save_dashboard_settings', {
          p_settings: canonical,
          p_expected_revision: dashboardNumber(revision),
        }),
      );
      if (saved.invalid || JSON.stringify(saved.settings) !== JSON.stringify(canonical))
        throw new Error('Dashboard settings acknowledgement differs.');
      return saved;
    },
    async summary(query: DashboardQuery) {
      return readDashboardSummary(await request('dashboard_summary', { p_query: query }), query);
    },
    async lessons(assets: LessonAssets, locale: Locale) {
      const index = await assets.index(locale);
      current();
      const units = index.units.map(({ unitId, contentVersion }) => ({ unitId, contentVersion }));
      const summaries = readLessonSummaries(
        await request('load_fundamentals_progress_summaries', { p_units: units }),
        units,
      );
      return index.units.map((entry) => {
        const summary = summaries.find(
          (item) => item.unitId === entry.unitId && item.contentVersion === entry.contentVersion,
        );
        if (!summary) throw new Error('A lesson progress summary is missing.');
        return {
          unitId: entry.unitId,
          title: entry.title,
          href: localePath(locale, `study/fundamentals/${entry.slug}`),
          summary,
        };
      });
    },
  };
}

export type MemberDashboardRepository = ReturnType<typeof createMemberDashboard>;
