import { expect, test } from '@playwright/test';
import { type Locale, locales } from '../../src/locales';
import {
  allowDashboardGuestStorage,
  dashboardOverview,
  dashboardText,
  seedGuestDashboardAttempts,
} from './dashboard.helpers';
import {
  expectLocalizedLayout,
  layoutConditions,
  openLocalizedDashboard,
  screenshotPath,
  setTheme,
} from './dashboard-layout.helpers';

for (const locale of locales) {
  test(`dashboard layout remains usable in ${locale}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/ja/dashboard/');
    await allowDashboardGuestStorage(page);
    await seedGuestDashboardAttempts(page);
    await page.reload();
    const overview = dashboardOverview(page);
    await expect(
      overview
        .locator('.dashboard-viz-metric')
        .filter({ hasText: dashboardText.dashboardMetricAnswered })
        .locator('strong'),
    ).toHaveText('2');
    await expect(
      overview
        .locator('.dashboard-viz-metric')
        .filter({ hasText: dashboardText.dashboardMetricAccuracy })
        .locator('strong'),
    ).toHaveText('50%');
    for (const condition of layoutConditions) {
      await page.setViewportSize({ width: condition.width, height: condition.height });
      await openLocalizedDashboard(page, locale as Locale);
      await setTheme(page, locale as Locale, condition.theme);
      await expectLocalizedLayout(page, locale as Locale, condition.width);
      const path = screenshotPath(locale as Locale, condition.width, condition.theme);
      if (path) await page.screenshot({ path, fullPage: false });
    }
  });
}
