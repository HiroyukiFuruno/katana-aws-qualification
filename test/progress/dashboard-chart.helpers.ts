import { expect, type Page } from '@playwright/test';
import type { DashboardChart } from '../../src/dashboard/preferenceTypes';
import { dashboardText, openDashboardAdvanced } from './dashboard.helpers';

export const chartFixture = {
  counts: [5, 6, 7] as const,
  durations: [
    [0, 1_000, 5_000, 10_000, 30_000],
    [0, 1_000, 5_000, 10_000, 30_000, 0],
    [0, 1_000, 5_000, 10_000, 30_000, 0, 1_000],
  ],
  total: 18,
  correct: 15,
  durationMs: 139_000,
  quartiles: { p25: 250, p50: 3_000, p75: 10_000 },
};

export async function seedChartFixture(page: Page) {
  return page.evaluate(async ({ counts, durations }) => {
    const { loadQuestions } = await import('/src/questions.ts');
    const { saveAttempt } = await import('/src/history.ts');
    const questions = await loadQuestions('courses/saa-c03/questions.json');
    const candidates = questions.filter((question) => question.correct.length === 1);
    const byCategory = new Map<string, (typeof candidates)[number]>();
    for (const question of candidates) {
      if (!byCategory.has(question.category)) byCategory.set(question.category, question);
    }
    const selected = [...byCategory.values()].slice(0, 3);
    if (selected.length !== 3) throw new Error('SAA fixture requires three categories.');
    if (new Set(selected.map((question) => `${question.version}:${question.revision}`)).size !== 1)
      throw new Error('SAA fixture requires one source revision.');
    for (const [categoryIndex, question] of selected.entries()) {
      for (let index = 0; index < counts[categoryIndex]; index += 1) {
        const last = index === counts[categoryIndex] - 1;
        const wrong = question.choices.find((choice) => !question.correct.includes(choice.id));
        if (last && !wrong) throw new Error('SAA fixture requires a wrong choice.');
        await saveAttempt(
          question,
          [last ? (wrong?.id ?? '') : question.correct[0]],
          last ? 'review' : 'study',
          durations[categoryIndex][index],
          'saa-c03',
        );
      }
    }
    return selected.map((question, index) => ({ category: question.category, count: counts[index] }));
  }, chartFixture);
}

export async function saveAllDashboardWidgets(page: Page) {
  await openDashboardAdvanced(page);
  await page.locator('.dashboard-controls').getByLabel(dashboardText.dashboardTimezone).fill('UTC');
  const picker = page.locator('.dashboard-widget-picker');
  while ((await picker.getByRole('button', { name: dashboardText.dashboardShowWidget }).count()) > 0) {
    await picker.getByRole('button', { name: dashboardText.dashboardShowWidget }).first().click();
  }
  await page.getByRole('button', { name: dashboardText.dashboardApply, exact: true }).click();
  await page.getByRole('button', { name: dashboardText.dashboardSave, exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: dashboardText.dashboardSaved })).toBeVisible();
}

export async function selectFixtureCharts(page: Page) {
  for (const [title, chart] of [
    [dashboardText.dashboardWidgetCategories, 'radar'],
    [dashboardText.dashboardWidgetDurations, 'box'],
  ] as const) {
    const widget = page.locator('.dashboard-widget').filter({
      has: page.getByRole('heading', { name: title, exact: true }),
    });
    const details = widget.locator('details.dashboard-widget-customize');
    if ((await details.getAttribute('open')) === null) await details.locator('summary').click();
    await details.getByLabel(dashboardText.dashboardChart).selectOption(chart);
  }
  await page.getByRole('button', { name: dashboardText.dashboardApply, exact: true }).click();
  await page.getByRole('button', { name: dashboardText.dashboardSave, exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: dashboardText.dashboardSaved })).toBeVisible();
}

export function chartWidget(page: Page, title: string) {
  return page
    .locator('.dashboard-widget')
    .filter({ has: page.getByRole('heading', { name: title, exact: true }) });
}
export async function chooseChart(page: Page, title: string, chart: DashboardChart) {
  const widget = chartWidget(page, title);
  const details = widget.locator('details.dashboard-widget-customize');
  if ((await details.getAttribute('open')) === null) await details.locator('summary').click();
  await details.getByLabel(dashboardText.dashboardChart).selectOption(chart);
}
