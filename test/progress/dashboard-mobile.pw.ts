import { expect, test } from '@playwright/test';
import { localePath, locales } from '../../src/locales';
import { messages } from '../../src/messages';
import {
  allowDashboardGuestStorage,
  seedGuestDashboardAttempts,
  dashboardText as t,
} from './dashboard.helpers';

test('mobile dashboard switches charts and keeps detailed data behind the chosen display level', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/ja/dashboard/');
  await allowDashboardGuestStorage(page);
  await seedGuestDashboardAttempts(page);
  await page.reload();

  const sections = page.getByRole('tablist', { name: t.dashboardSectionTabs });
  const activity = sections.getByRole('tab', { name: t.dashboardSectionActivity });
  const breakdown = sections.getByRole('tab', { name: t.dashboardSectionBreakdown });
  const trend = page.locator('.dashboard-widget-kind-trend');
  const table = trend.getByRole('table', { name: t.dashboardWidgetTrend });
  await expect(activity).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel')).toHaveCount(1);
  await expect(trend.locator('.dashboard-viz-svg')).toBeInViewport({ ratio: 0.5 });
  await expect(table).toBeHidden();
  await trend
    .getByText(`${t.dashboardDetailTable} · ${t.dashboardWidgetTrend}`, { exact: true })
    .click();
  await expect(table).toBeVisible();

  await activity.focus();
  await page.keyboard.press('ArrowRight');
  await expect(breakdown).toBeFocused();
  await expect(breakdown).toHaveAttribute('aria-selected', 'true');
  await expect(trend).toHaveCount(0);
  await expect(page.getByRole('tabpanel')).toHaveCount(1);
  await expect(page.locator('.dashboard-widget')).toHaveCount(1);
  await page.keyboard.press('End');
  await expect(sections.getByRole('tab', { name: t.dashboardSectionLessons })).toBeFocused();
  await page.keyboard.press('Home');
  await expect(activity).toBeFocused();

  const settings = page.locator('.dashboard-controls');
  await settings.getByText(t.dashboardSettings, { exact: true }).click();
  const density = settings.getByLabel(t.dashboardDensity);
  await expect(density).toHaveValue('standard');
  await density.selectOption('compact');
  await expect(trend.locator('table')).toHaveCount(0);
  await expect(trend.locator('.dashboard-viz-svg')).toBeVisible();
  await page.getByLabel(t.dashboardSectionWidget).selectOption('overview');
  await expect(page.locator('.dashboard-viz-metric')).toHaveCount(2);
  await density.selectOption('full');
  await expect(table).toBeVisible();
  await expect(page.locator('.dashboard-widget')).toHaveCount(3);
  await expect(page.locator('.dashboard-widget-kind-lessons')).toHaveCount(0);
  await page.reload();
  await expect(table).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});

for (const locale of locales) {
  test(`mobile settings and saved choices work in ${locale}`, async ({ page }) => {
    const text = messages[locale];
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(localePath(locale, 'dashboard'));
    await allowDashboardGuestStorage(page, locale);
    const settings = page.locator('.dashboard-controls');
    const settingsToggle = settings.getByText(text.dashboardSettings, { exact: true });
    await settingsToggle.click();
    const basic = settings.getByRole('button', { name: text.dashboardSettingsBasic, exact: true });
    const advanced = settings.getByRole('button', { name: text.dashboardSettingsAdvanced, exact: true });
    const display = settings.getByRole('tab', { name: text.dashboardSettingsDisplay, exact: true });
    const filters = settings.getByRole('tab', { name: text.dashboardSettingsFilters, exact: true });
    const density = settings.getByRole('combobox', { name: text.dashboardDensity, exact: true });
    const period = settings.getByRole('combobox', { name: text.dashboardPeriod, exact: true });
    const format = settings.getByRole('listbox', { name: text.dashboardFormat, exact: true });
    const widget = settings.getByRole('combobox', { name: text.dashboardSectionWidget, exact: true });
    const chart = settings.getByRole('combobox', { name: text.dashboardChart, exact: true });

    await expect(basic).toHaveAttribute('aria-pressed', 'true');
    await expect(settings.getByRole('tabpanel')).toHaveCount(1);
    await expect(density.locator('option')).toHaveText([
      text.dashboardDensityCompact,
      text.dashboardDensityStandard,
      text.dashboardDensityFull,
    ]);
    await expect(density).toHaveValue('standard');
    await density.selectOption({ label: text.dashboardDensityCompact });
    await expect(settings.getByText(text.dashboardDensityCompactHelp, { exact: true })).toBeVisible();
    await expect(settings.getByLabel(text.dashboardTimezone)).toHaveCount(0);
    await expect(period).toHaveCount(0);
    await filters.click();
    await period.selectOption({ label: text.dashboard7d });
    await advanced.click();
    await expect(settings.getByLabel(text.dashboardTimezone)).toBeVisible();
    await format.selectOption('choice-single');
    await display.click();
    await widget.selectOption({ label: text.dashboardWidgetTrend });
    await chart.selectOption('line');
    await period.selectOption({ label: text.dashboard30d });
    await expect(settings.locator('.dashboard-filter-grid input')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    await basic.click();
    await filters.click();
    await expect(period).toHaveValue('7d');
    await settings.getByRole('button', { name: text.dashboardSave, exact: true }).click();
    await expect(settings.getByText(text.dashboardSaved, { exact: true })).toBeVisible();

    await page.reload();
    await settingsToggle.click();
    await expect(density).toHaveValue('compact');
    await filters.click();
    await expect(period).toHaveValue('7d');
    await advanced.click();
    await expect(format).toHaveValues(['choice-single']);
    await display.click();
    await widget.selectOption({ label: text.dashboardWidgetTrend });
    await expect(chart).toHaveValue('line');
    await expect(period).toHaveValue('30d');
    await page.setViewportSize({ width: 320, height: 568 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  });
}
