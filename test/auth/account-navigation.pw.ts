import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

test('guest avatar menu is hidden until opened and supports keyboard and outside dismissal', async ({
  page,
}) => {
  await page.goto('/ja/');
  const button = page.getByRole('button', { name: 'アカウントメニュー' });
  const menu = page.locator('#account-menu-links');
  await expect(menu).toBeHidden();
  await expect(page.getByRole('link', { name: '無料アカウントを作成' }).first()).toBeVisible();
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(menu).toBeVisible();
  await expect(menu).toContainText('ゲスト');
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(button).toBeFocused();
  await button.click();
  await page.getByRole('heading', { level: 1 }).click();
  await expect(menu).toBeHidden();
  await button.click();
  await page.locator('header a.brand').focus();
  await expect(menu).toBeHidden();
});

test('verified account menu exposes settings and logout without guest registration offers', async ({
  page,
}) => {
  await signIn(page);
  await page.getByRole('button', { name: 'アカウントメニュー' }).click();
  const menu = page.locator('#account-menu-links');
  await expect(menu.getByRole('link', { name: 'アカウント設定' })).toBeVisible();
  await expect(menu.getByRole('link', { name: '無料アカウントを作成' })).toHaveCount(0);
  await menu.getByRole('button', { name: 'ログアウト', exact: true }).click();
  await expect(page).toHaveURL(/\/ja\/$/);
  await expect(page.getByRole('link', { name: '無料アカウントを作成' }).first()).toBeVisible();
});

test('mobile light and dark layouts retain a usable avatar menu and SSO registration path', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    await page.goto('/ja/login/');
    await expect(page.getByRole('button', { name: 'GitHubでログイン' })).toBeVisible();
    await page.getByRole('button', { name: 'アカウントメニュー' }).click();
    const bounds = await page.locator('#account-menu-links').boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds?.x).toBeGreaterThanOrEqual(0);
    expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(390);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  }
});
