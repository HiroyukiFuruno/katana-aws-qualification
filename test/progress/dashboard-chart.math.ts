import { expect, type Page } from '@playwright/test';
import { dashboardText } from './dashboard.helpers';
import { chartWidget } from './dashboard-chart.helpers';

export type CategoryFixture = { category: string; count: number };
async function orderedCounts(page: Page, title: string, fixture: CategoryFixture[]) {
  const labels = await chartWidget(page, title)
    .locator('.dashboard-viz-table tbody th')
    .allTextContents();
  return labels.map((label) => {
    const row = fixture.find((item) => label.includes(item.category));
    if (!row) throw new Error(`Unexpected category row: ${label}`);
    return row.count;
  });
}

export async function expectDefaultCharts(page: Page, fixture: CategoryFixture[]) {
  const modes = chartWidget(page, dashboardText.dashboardWidgetModes);
  await expect(modes.locator('.dashboard-viz-donut circle')).toHaveCount(2);
  const fractions = (
    await modes
      .locator('circle')
      .evaluateAll((nodes) =>
        nodes.map((node) => Number(node.getAttribute('stroke-dasharray')?.split(' ')[0])),
      )
  ).sort((a, b) => a - b);
  expect(fractions[0]).toBeCloseTo(3 / 18, 9);
  expect(fractions[1]).toBeCloseTo(15 / 18, 9);
  const categories = chartWidget(page, dashboardText.dashboardWidgetCategories);
  await expect(categories.locator('.dashboard-viz-bar-row')).toHaveCount(3);
  for (const row of fixture) {
    const bar = categories.locator('.dashboard-viz-bar-row').filter({ hasText: row.category });
    const width = await bar
      .locator('.dashboard-viz-track > span')
      .evaluate((node) => Number.parseFloat((node as HTMLElement).style.width));
    expect(width).toBeCloseTo(((row.count - 1) / row.count) * 100, 3);
  }
  const duration = chartWidget(page, dashboardText.dashboardWidgetDurations);
  const bins = duration.getByRole('table', { name: dashboardText.dashboardTimeBins, exact: true });
  await expect(bins.locator('tbody tr')).toHaveCount(8);
  expect((await bins.getByRole('cell').allTextContents()).map(Number)).toEqual([5, 4, 3, 3, 3, 0, 0, 0]);
  const heights = await chartWidget(page, dashboardText.dashboardWidgetTrend)
    .locator('rect')
    .evaluateAll((nodes) => nodes.map((node) => Number(node.getAttribute('height'))));
  expect(heights.filter((height) => height > 0)).toEqual([130]);
  const date = await page.evaluate(() => new Date().toISOString().slice(0, 10));
  await expect(
    chartWidget(page, dashboardText.dashboardWidgetCalendar).locator(`[title="${date}: 18"]`),
  ).toHaveCount(1);
}

export async function expectModifiedCharts(page: Page, fixture: CategoryFixture[]) {
  const category = chartWidget(page, dashboardText.dashboardWidgetCategories);
  await expect(category.locator('.dashboard-viz-radar-value')).toHaveCount(1);
  const counts = await orderedCounts(page, dashboardText.dashboardWidgetCategories, fixture);
  const points = (await category.locator('.dashboard-viz-radar-value').getAttribute('points'))
    ?.split(' ')
    .map((value) => value.split(',').map(Number));
  expect(points).toHaveLength(3);
  for (const [index, count] of counts.entries()) {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / 3;
    expect(points?.[index][0]).toBeCloseTo(120 + (Math.cos(angle) * 88 * (count - 1)) / count, 6);
    expect(points?.[index][1]).toBeCloseTo(120 + (Math.sin(angle) * 88 * (count - 1)) / count, 6);
  }
  const relation = chartWidget(page, dashboardText.dashboardWidgetRelationship);
  await expect(relation.locator('.dashboard-viz-svg circle')).toHaveCount(3);
  const ordered = await orderedCounts(page, dashboardText.dashboardWidgetRelationship, fixture);
  for (const [index, count] of ordered.entries()) {
    const point = relation.locator('.dashboard-viz-svg circle').nth(index);
    const total = count === 7 ? 47000 : 46000;
    expect(Number(await point.getAttribute('cx'))).toBeCloseTo(32 + (count / 7) * 260, 6);
    expect(Number(await point.getAttribute('cy'))).toBeCloseTo(176 - ((count - 1) / count) * 144, 6);
    expect(Number(await point.getAttribute('r'))).toBeCloseTo(22 * Math.sqrt(total / count / 9200), 6);
  }
  const duration = chartWidget(page, dashboardText.dashboardWidgetDurations);
  await expect(duration.locator('.dashboard-viz-quartiles')).toHaveCount(1);
  expect(Number(await duration.locator('.dashboard-viz-quartiles').getAttribute('x'))).toBeCloseTo(
    30 + (250 / 30000) * 260,
    6,
  );
  expect(Number(await duration.locator('.dashboard-viz-quartiles').getAttribute('width'))).toBeCloseTo(
    ((10000 - 250) / 30000) * 260,
    6,
  );
  expect(Number(await duration.locator('.dashboard-viz-median').getAttribute('x1'))).toBeCloseTo(56, 6);
  const table = duration.getByRole('table', {
    name: dashboardText.dashboardWidgetDurations,
    exact: true,
  });
  await expect(
    table.getByRole('row').filter({ hasText: dashboardText.dashboardQ1 }).getByRole('cell'),
  ).toContainText('0.25');
  await expect(
    table.getByRole('row').filter({ hasText: dashboardText.dashboardMedian }).getByRole('cell'),
  ).toHaveText(/3\s*秒/);
}
