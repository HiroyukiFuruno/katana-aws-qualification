import { expect, type Page } from '@playwright/test';
import { dashboardText } from './dashboard.helpers';
import { chartWidget, chooseChart } from './dashboard-chart.helpers';
import type { CategoryFixture } from './dashboard-chart.math';

export async function expectAlternativeCharts(page: Page, fixture: CategoryFixture[]) {
  await chooseChart(page, dashboardText.dashboardWidgetCategories, 'stacked');
  const categories = await chartWidget(page, dashboardText.dashboardWidgetCategories);
  await expect(categories.locator('.dashboard-viz-track > span')).toHaveCount(6);
  for (const row of fixture) {
    const segments = categories
      .locator('.dashboard-viz-bar-row')
      .filter({ hasText: row.category })
      .locator('.dashboard-viz-track > span');
    const widths = await segments.evaluateAll((nodes) =>
      nodes.map((node) => Number.parseFloat((node as HTMLElement).style.width)),
    );
    expect(widths[0]).toBeCloseTo(((row.count - 1) / row.count) * 100, 3);
    expect(widths[1]).toBeCloseTo(100 / row.count, 3);
  }
  await chooseChart(page, dashboardText.dashboardWidgetRelationship, 'scatter');
  const points = (await chartWidget(page, dashboardText.dashboardWidgetRelationship)).locator(
    '.dashboard-viz-svg circle',
  );
  await expect(points).toHaveCount(3);
  for (let index = 0; index < 3; index++) await expect(points.nth(index)).toHaveAttribute('r', '4');
  await chooseChart(page, dashboardText.dashboardWidgetTrend, 'line');
  await expect(
    (await chartWidget(page, dashboardText.dashboardWidgetTrend)).locator('.dashboard-viz-line'),
  ).toHaveCount(1);
  await chooseChart(page, dashboardText.dashboardWidgetTrend, 'area');
  await expect(
    (await chartWidget(page, dashboardText.dashboardWidgetTrend)).locator('.dashboard-viz-area'),
  ).toHaveCount(1);
  await chooseChart(page, dashboardText.dashboardWidgetCertifications, 'donut');
  await expect(
    (await chartWidget(page, dashboardText.dashboardWidgetCertifications)).getByText(
      dashboardText.dashboardDonutRequirement,
      { exact: true },
    ),
  ).toBeVisible();
  await chooseChart(page, dashboardText.dashboardWidgetLessons, 'ring');
  const rings = (await chartWidget(page, dashboardText.dashboardWidgetLessons)).locator(
    '.dashboard-viz-donut circle',
  );
  await expect(rings).toHaveCount(12);
  expect(await rings.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('stroke')))).toEqual(
    Array(12).fill('var(--line)'),
  );
}
