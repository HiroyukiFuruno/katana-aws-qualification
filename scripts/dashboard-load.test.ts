import { expect, test } from 'bun:test';
import { aggregateDashboard } from '../src/dashboard/aggregate';
import { loadDashboardWidgets } from '../src/dashboard/loadWidgets';
import { dashboardDefaults } from '../src/dashboard/preferences';
import type { DashboardDataState } from '../src/dashboard/viewTypes';
import { records } from './dashboard-fixture';

test('widgets with identical resolved conditions share one request; explicit all stays distinct', async () => {
  const preferences = dashboardDefaults('UTC');
  preferences.filters.certificationIds = ['saa-c03'];
  preferences.widgets[1].overrides.certificationIds = null;
  const seen: string[] = [];
  const results = new Map<string, DashboardDataState>();
  await loadDashboardWidgets({
    preferences,
    asOf: Date.parse('2026-11-20T12:00:00Z'),
    isCurrent: () => true,
    retry() {},
    summary: async (query) => {
      seen.push(JSON.stringify(query));
      return { summary: aggregateDashboard(records, query), excludedRecords: 0 };
    },
    publish(ids, state) {
      for (const id of ids) results.set(id, state);
    },
  });
  expect(seen).toHaveLength(2);
  expect(results.size).toBe(9);
  const overview = results.get('overview');
  const trend = results.get('trend');
  expect(overview?.status === 'ready' && overview.summary.total.answered).toBe(4);
  expect(trend?.status === 'ready' && trend.summary.total.answered).toBe(6);
});

test('late query results do not publish after the request scope changes', async () => {
  let active = true;
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const states: DashboardDataState[] = [];
  const request = loadDashboardWidgets({
    preferences: dashboardDefaults('UTC'),
    asOf: Date.parse('2026-11-20T12:00:00Z'),
    isCurrent: () => active,
    retry() {},
    summary: async (query) => {
      await gate;
      return { summary: aggregateDashboard(records, query), excludedRecords: 0 };
    },
    publish: (_, state) => states.push(state),
  });
  active = false;
  release?.();
  await request;
  expect(states).toEqual([]);
});
