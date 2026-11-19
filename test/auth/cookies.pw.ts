import { expect, test } from '@playwright/test';

test('global cookie choice gates analytics, persists and can be revoked', async ({ page }) => {
  await page.goto('/ja/');
  const banner = page.getByRole('region', { name: 'Cookie設定' });
  await expect(banner).toBeVisible();
  await expect(page.locator('#katana-analytics')).toHaveCount(0);
  await banner.getByRole('button', { name: '必要なもののみ', exact: true }).click();
  await page.reload();
  await expect(banner).toHaveCount(0);
  await expect(page.locator('#katana-analytics')).toHaveCount(0);
  await page.getByRole('button', { name: 'Cookie設定', exact: true }).click();
  await banner.getByRole('button', { name: 'すべて許可', exact: true }).click();
  await expect(page.locator('#katana-analytics')).toHaveCount(1);
  await page.goto('/ja/certifications/saa-c03/');
  await expect(banner).toHaveCount(0);
  await page.getByRole('button', { name: 'Cookie設定', exact: true }).click();
  await banner.getByRole('button', { name: '必要なもののみ', exact: true }).click();
  await expect(page.locator('#katana-analytics')).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('katana-aws:cookie-consent')))
    .toBe('denied');
});

test('cookie banner fits mobile and stays available on account routes', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/ja/login/');
  await expect(page.getByRole('region', { name: 'Cookie設定' })).toBeVisible();
  await page.getByRole('button', { name: 'すべて許可', exact: true }).click();
  await expect(page.locator('#katana-analytics')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('revocation in another tab stops tracking', async ({ page, context }) => {
  await page.goto('/ja/');
  await page.getByRole('button', { name: 'すべて許可', exact: true }).click();
  const other = await context.newPage();
  await other.goto('/ja/');
  await expect(other.locator('#katana-analytics')).toHaveCount(1);
  await page.getByRole('button', { name: 'Cookie設定', exact: true }).click();
  await page.getByRole('button', { name: '必要なもののみ', exact: true }).click();
  await expect(other.locator('#katana-analytics')).toHaveCount(0);
  await expect
    .poll(() => other.evaluate(() => localStorage.getItem('katana-aws:cookie-consent')))
    .toBe('denied');
});

test('analytics choice opens global consent instead of showing an ineffective check', async ({
  page,
}) => {
  await page.goto('/ja/privacy/');
  await page.getByRole('button', { name: '必要なもののみ', exact: true }).click();
  const analytics = page.locator('main input[type=checkbox]');
  await analytics.click();
  await expect(analytics).not.toBeChecked();
  await expect(page.getByRole('region', { name: 'Cookie設定' })).toBeVisible();
  await page.getByRole('button', { name: 'すべて許可', exact: true }).click();
  await expect(analytics).toBeChecked();
});
