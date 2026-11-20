import { expect, test } from '@playwright/test';
import { openMemberCourse } from './course';
import {
  allowDashboardGuestStorage,
  clearGuestConsent,
  dashboardOverview,
  dashboardText,
  expectDashboardMetrics,
  openDashboardAdvanced,
  openWidgetCustomize,
  saveMemberDashboardAttempts,
  seedGuestDashboardAttempts,
} from './dashboard.helpers';
import { createSessions, setRealSession } from './sessions';

test('unconsented guest does not read saved learning records for dashboard data', async ({
  browser,
}) => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto('/ja/');
    await seedGuestDashboardAttempts(page);
    await clearGuestConsent(page);
    const requests: string[] = [];
    page.on('request', (request) => requests.push(request.url()));
    await page.goto('/ja/dashboard/');
    await expect(page.getByRole('checkbox', { name: dashboardText.progressStorageAllow })).toBeVisible();
    await expect(page.getByRole('link', { name: dashboardText.accountCreateCta })).toBeVisible();
    await expect(page.locator('.dashboard-widget')).toHaveCount(0);
    expect(
      requests.some((url) => url.includes('dashboard_summary') || url.includes('learning_events')),
    ).toBe(false);
  } finally {
    await context.close();
  }
});

test('consented guest dashboard aggregates persisted public-question attempts without a cookie', async ({
  browser,
}) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage();
    await page.goto('/ja/dashboard/');
    await allowDashboardGuestStorage(page);
    await seedGuestDashboardAttempts(page);
    await page.reload();
    await expectDashboardMetrics(page, '2', '50%');
    await expect(
      page.locator('.dashboard-widget').getByText(dashboardText.dashboardLoading, { exact: true }),
    ).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    await page.screenshot({ path: 'test-results/dashboard/guest-390.png' });
    await expect(page.locator('.dashboard-viz-metric').filter({ hasText: '1 / 2' })).toHaveCount(1);
    await expect(page).not.toHaveURL(/cookie/i);
    await expect
      .poll(() => page.evaluate(() => document.cookie.includes('saa_study_incorrect_v1')))
      .toBe(false);
    await page.reload();
    await expectDashboardMetrics(page, '2', '50%');
  } finally {
    await context.close();
  }
});

test('member dashboard is isolated from another member and retained guest history', async ({
  browser,
}) => {
  const [first, second] = await createSessions();
  const firstContext = await browser.newContext();
  const secondContext = await browser.newContext();
  try {
    const firstPage = await firstContext.newPage();
    await firstPage.goto('/ja/');
    await seedGuestDashboardAttempts(firstPage);
    await openMemberCourse(firstPage, first);
    await saveMemberDashboardAttempts(firstPage);
    await firstPage.goto('/ja/dashboard/');
    await expectDashboardMetrics(firstPage, '2', '50%');

    await setRealSession(firstPage, second);
    await expectDashboardMetrics(firstPage, '0', dashboardText.dashboardNotMeasured);
    await setRealSession(firstPage, first);
    await expectDashboardMetrics(firstPage, '2', '50%');

    const secondPage = await secondContext.newPage();
    await secondPage.goto('/ja/dashboard/');
    await setRealSession(secondPage, second);
    await secondPage.reload();
    await expectDashboardMetrics(secondPage, '0', dashboardText.dashboardNotMeasured);
  } finally {
    await Promise.all([firstContext.close(), secondContext.close()]);
  }
});

test('member settings persist independently and widget overrides differ from global filters', async ({
  browser,
}) => {
  const [first, second] = await createSessions();
  const firstContext = await browser.newContext();
  const secondContext = await browser.newContext();
  try {
    const firstPage = await firstContext.newPage();
    await openMemberCourse(firstPage, first);
    await saveMemberDashboardAttempts(firstPage);
    await firstPage.goto('/ja/dashboard/');
    const controls = firstPage.locator('.dashboard-controls');
    await openDashboardAdvanced(firstPage);
    await controls.getByLabel(dashboardText.dashboardFormat).selectOption('choice-single');
    await controls.getByRole('button', { name: dashboardText.dashboardApply }).click();
    await expectDashboardMetrics(firstPage, '1', '100%');
    const overview = dashboardOverview(firstPage);
    await openWidgetCustomize(overview);
    await overview
      .locator('label')
      .filter({ hasText: dashboardText.dashboardFormat })
      .getByRole('button', { name: dashboardText.dashboardAll })
      .click();
    await expectDashboardMetrics(firstPage, '2', '50%');
    await controls.getByRole('button', { name: dashboardText.dashboardSave }).click();
    await expect(
      firstPage.getByRole('status').filter({ hasText: dashboardText.dashboardSaved }),
    ).toBeVisible();
    await firstPage.reload();
    await openDashboardAdvanced(firstPage);
    await expect(controls.getByLabel(dashboardText.dashboardFormat)).toHaveValues(['choice-single']);

    const secondPage = await secondContext.newPage();
    await secondPage.goto('/ja/dashboard/');
    await setRealSession(secondPage, second);
    await secondPage.reload();
    await expect(
      secondPage.locator('.dashboard-controls').getByLabel(dashboardText.dashboardPeriod),
    ).toHaveValue('30d');
  } finally {
    await Promise.all([firstContext.close(), secondContext.close()]);
  }
});
