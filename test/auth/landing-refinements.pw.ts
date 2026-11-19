import { expect, test } from '@playwright/test';
import { locales } from '../../src/locales';
import { visibleBounds } from './layout';

test('the learning mark uses the same outlined image in every locale', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/ja/');
  const mark = page.locator('.landing-identity-mark');
  await expect(mark).toBeVisible();
  for (const locale of locales) {
    await page.locator('#site-locale').selectOption(locale);
    const style = await mark.evaluate((element) => getComputedStyle(element).maskImage);
    expect(style).toContain('/brand/learning-mark.svg');
    await expect(mark).toBeEmpty();
    const box = await visibleBounds(mark);
    expect(box.width).toBeCloseTo(box.height, 0);
  }
  const asset = await page.request.get('/brand/learning-mark.svg');
  expect(asset.ok()).toBe(true);
  const svg = await asset.text();
  expect(svg).toContain('<path');
  expect(svg).toContain('<title>學</title>');
  expect(svg).not.toContain('<text');
});

test('account creation is prominent after value is explained and before the tools', async ({ page }) => {
  await page.goto('/ja/');
  const pitch = page.locator('.landing-account-pitch');
  await expect(pitch).toBeVisible();
  await expect(pitch.getByRole('link', { name: '無料アカウントを作成' })).toBeVisible();
  await expect(pitch.getByRole('heading', { level: 2 })).toBeVisible();
  await expect(pitch.locator('li')).toHaveCount(3);
  await expect(pitch).toContainText('準備中');
  const [values, account, paths] = await Promise.all([
    visibleBounds(page.locator('.landing-values')),
    visibleBounds(page.locator('.landing-account-pitch')),
    visibleBounds(page.locator('.landing-paths')),
  ]);
  expect(account.y).toBeGreaterThanOrEqual(values.y + values.height);
  expect(paths.y).toBeGreaterThanOrEqual(account.y + account.height);
});

test('AWS certification remains explicit in the introduction and use heading', async ({ page }) => {
  await page.goto('/ja/');
  await expect(page.locator('main h1')).toHaveText('気楽に学ぶ、AWS。');
  await expect(page.locator('.landing-hero p')).toContainText('AWS認定資格');
  await expect(page.locator('.landing-concept h3')).toContainText('AWS認定資格');
});
