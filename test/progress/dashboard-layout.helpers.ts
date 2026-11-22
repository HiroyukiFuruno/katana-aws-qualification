import { expect, type Page } from '@playwright/test';
import { type Locale, localePath } from '../../src/locales';
import { messages } from '../../src/messages';
import { showDashboardWidget } from './dashboard-actions';

export const layoutConditions = [
  { width: 390, height: 844, theme: 'light' },
  { width: 390, height: 844, theme: 'dark' },
  { width: 320, height: 568, theme: 'light' },
  { width: 320, height: 568, theme: 'dark' },
  { width: 768, height: 1024, theme: 'light' },
  { width: 768, height: 1024, theme: 'dark' },
  { width: 1280, height: 900, theme: 'light' },
  { width: 1280, height: 900, theme: 'dark' },
] as const;

export async function openLocalizedDashboard(page: Page, locale: Locale) {
  await page.goto(localePath(locale, 'dashboard'));
  await expect(
    page.getByRole('heading', { name: messages[locale].dashboardTitle, exact: true }),
  ).toBeVisible();
}

export async function setTheme(page: Page, locale: Locale, theme: 'light' | 'dark') {
  const toggle = page.getByRole('button', { name: messages[locale].darkMode, exact: true });
  const current = await page.evaluate(() => document.documentElement.dataset.theme ?? 'light');
  if (current !== theme) await toggle.click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.theme ?? 'light'))
    .toBe(theme);
  await expect(toggle).toHaveAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
}

export async function expectLocalizedLayout(page: Page, locale: Locale, width: number) {
  const text = messages[locale];
  const overview = await showDashboardWidget(page, text.dashboardWidgetOverview, locale);
  await expect(page.getByText(text.progressGuestSource, { exact: true })).toBeVisible();
  const metric = (label: string) =>
    overview.locator('.dashboard-viz-metric').filter({
      has: page.getByText(label, { exact: true }),
    });
  await expect(
    metric(text.dashboardMetricAnswered).getByText(text.dashboardMetricAnswered, {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    metric(text.dashboardMetricAccuracy).getByText(text.dashboardMetricAccuracy, {
      exact: true,
    }),
  ).toBeVisible();
  await expect(metric(text.dashboardMetricAnswered).locator('strong')).toHaveText('2');
  await expect(metric(text.dashboardMetricAccuracy).locator('strong')).toHaveText(/50\s*%/);
  const trend = await showDashboardWidget(page, text.dashboardWidgetTrend, locale);
  await expect(trend.locator('table')).toBeHidden();
  await expect(
    trend.getByText(`${text.dashboardDetailTable} · ${text.dashboardWidgetTrend}`, { exact: true }),
  ).toBeVisible();
  await expect(page.locator('.dashboard-viz-svg').first()).toBeVisible();
  await expect(page.locator('.dashboard-controls[open]')).toHaveCount(0);
  if (width >= 768)
    await expect(page.locator('.dashboard-viz-svg').first()).toBeInViewport({ ratio: 0.5 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(width);
  await expect.poll(() => page.evaluate(() => document.documentElement.clientWidth)).toBe(width);
  await page.keyboard.press('Tab');
  await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).not.toBe('BODY');
  expect(localePath(locale, 'dashboard')).toContain(
    locale === 'en' ? '/dashboard' : `/${locale}/dashboard`,
  );
}

export function screenshotPath(locale: Locale, width: number, theme: 'light' | 'dark') {
  if (locale === 'ja' && width === 390) return `test-results/dashboard/${locale}-${width}-${theme}.png`;
  if (locale === 'de' && width === 320 && theme === 'light')
    return `test-results/dashboard/${locale}-${width}-${theme}.png`;
  if (locale === 'ja' && (width === 768 || width === 1280))
    return `test-results/dashboard/${locale}-${width}-${theme}.png`;
  return undefined;
}
