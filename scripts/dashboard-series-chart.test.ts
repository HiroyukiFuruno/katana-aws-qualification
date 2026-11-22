import { expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import content from '../public/translations/en/site.json';
import { aggregateDashboard } from '../src/dashboard/aggregate';
import { createDashboardDisplayLabels } from '../src/dashboard/displayLabels';
import { dashboardDefaults } from '../src/dashboard/preferences';
import type { DashboardWidget } from '../src/dashboard/preferenceTypes';
import type { DashboardSummary } from '../src/dashboard/summaryTypes';
import { DashboardDensityContext } from '../src/dashboard/visual/DashboardDensity';
import { dashboardGroupRows } from '../src/dashboard/visual/groupRows';
import { SeriesChart } from '../src/dashboard/visual/SeriesChart';
import { messages } from '../src/messages';
import { query, records } from './dashboard-fixture';

function renderChart(
  kind: 'modes' | 'categories',
  chart: DashboardWidget['chart'],
  summary: DashboardSummary,
) {
  const configured = dashboardDefaults('Asia/Tokyo').widgets.find((widget) => widget.kind === kind);
  if (!configured) throw new Error('Dashboard widget is missing.');
  const widget: DashboardWidget = { ...configured, chart };
  return renderToStaticMarkup(
    createElement(
      DashboardDensityContext.Provider,
      { value: 'compact' },
      createElement(SeriesChart, {
        widget,
        rows: dashboardGroupRows(
          widget,
          summary,
          (value) => value,
          createDashboardDisplayLabels(content, (key) => messages.en[key], []),
        ),
        categories: summary.groups.categories,
      }),
    ),
  );
}

test('compact donut falls back to numbers when only one mode has answers', () => {
  const oneMode = aggregateDashboard(records, { ...query, modes: ['study'] });
  const fallback = renderChart('modes', 'donut', oneMode);
  expect(fallback).toContain(messages.en.dashboardDonutRequirement);
  expect(fallback).toContain('<table');
  expect(fallback).not.toContain('dashboard-viz-donut');

  const multipleModes = renderChart('modes', 'donut', aggregateDashboard(records, query));
  expect(multipleModes).toContain('dashboard-viz-donut');
  expect(multipleModes).not.toContain('<table');
});

test('compact radar falls back to numbers when categories lack enough answers', () => {
  const fallback = renderChart('categories', 'radar', aggregateDashboard(records, query));
  expect(fallback).toContain(messages.en.dashboardRadarRequirement);
  expect(fallback).toContain('<table');
  expect(fallback).not.toContain('dashboard-viz-radar-value');
});
