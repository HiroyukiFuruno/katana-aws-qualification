import { expect, type Page, test } from '@playwright/test';
import { allowDashboardGuestStorage, dashboardText } from './dashboard.helpers';
import {
  openDashboardAdvanced,
  openDashboardWidgetSettings,
  setDashboardDensity,
} from './dashboard-actions';

function dashboardWidgets(page: Page) {
  return page.locator('.dashboard-widget');
}

function dashboardWidget(page: Page, title: string) {
  return dashboardWidgets(page).filter({
    has: page.getByRole('heading', { name: title, exact: true }),
  });
}

function widgetTitles(page: Page) {
  return dashboardWidgets(page)
    .locator('.dashboard-widget-heading > h2')
    .evaluateAll((headings) => headings.slice(0, 3).map((heading) => heading.textContent));
}

async function openGuestDashboard(page: Page) {
  await page.goto('/ja/dashboard/');
  await allowDashboardGuestStorage(page);
  await setDashboardDensity(page, 'full');
}

test('guest keeps two instances of the same widget after saving and reloading', async ({ browser }) => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await openGuestDashboard(page);
    await openDashboardWidgetSettings(page);
    const addDetails = page.locator('.dashboard-controls details').filter({
      hasText: dashboardText.dashboardAddWidget,
    });
    await addDetails.locator('summary').click();
    const addTrend = page.getByRole('button', {
      name: `${dashboardText.dashboardAddWidget} ${dashboardText.dashboardWidgetTrend}`,
    });
    await addTrend.click();
    await expect(dashboardWidget(page, dashboardText.dashboardWidgetTrend)).toHaveCount(2);
    await page.getByRole('button', { name: dashboardText.dashboardSave }).click();
    await expect(
      page.getByRole('status').filter({ hasText: dashboardText.dashboardSaved }),
    ).toBeVisible();

    await page.reload();
    await expect(dashboardWidget(page, dashboardText.dashboardWidgetTrend)).toHaveCount(2);
  } finally {
    await context.close();
  }
});

test('guest moves widgets with the keyboard while retaining focus', async ({ browser }) => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await openGuestDashboard(page);
    const editor = await openDashboardWidgetSettings(page, dashboardText.dashboardWidgetTrend);
    const up = editor.getByRole('button', { name: dashboardText.dashboardMoveUp });
    await up.focus();
    await page.keyboard.press('Enter');
    await expect
      .poll(() => widgetTitles(page))
      .toEqual([
        dashboardText.dashboardWidgetTrend,
        dashboardText.dashboardWidgetOverview,
        dashboardText.dashboardWidgetCalendar,
      ]);
    await expect(up).toBeFocused();

    const down = editor.getByRole('button', { name: dashboardText.dashboardMoveDown });
    await down.focus();
    await page.keyboard.press('Enter');
    await expect
      .poll(() => widgetTitles(page))
      .toEqual([
        dashboardText.dashboardWidgetOverview,
        dashboardText.dashboardWidgetTrend,
        dashboardText.dashboardWidgetCalendar,
      ]);
    await expect(down).toBeFocused();
  } finally {
    await context.close();
  }
});

test('guest can select a reading-only fundamentals unit in dashboard filters', async ({ browser }) => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await openGuestDashboard(page);
    await openDashboardAdvanced(page);
    const units = page
      .locator('.dashboard-controls')
      .getByLabel(dashboardText.dashboardUnit)
      .locator('option');
    await expect
      .poll(() => units.evaluateAll((options) => options.map((option) => option.getAttribute('value'))))
      .toContain('fundamentals.observability');
  } finally {
    await context.close();
  }
});
