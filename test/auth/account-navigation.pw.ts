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
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await expect(page.getByRole('heading', { name: 'アカウント設定' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '連携解除', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'アカウントを削除', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'アカウントメニュー' }).click();
  const menu = page.locator('#account-menu-links');
  const settings = menu.getByRole('link', { name: 'アカウント設定' });
  await expect(settings).toHaveAttribute('href', '/ja/account/settings/');
  await expect(settings).toBeVisible();
  await settings.click();
  await expect(page).toHaveURL(/\/ja\/account\/settings\/$/);
  await expect(page.getByRole('heading', { name: 'アカウント設定' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '学習ダッシュボード' })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.getByRole('button', { name: 'アカウントメニュー' }).click();
  await expect(menu.getByRole('link', { name: '無料アカウントを作成' })).toHaveCount(0);
  await menu.getByRole('button', { name: 'ログアウト', exact: true }).click();
  await expect(page).toHaveURL(/\/ja\/$/);
  await expect(page.getByRole('link', { name: '無料アカウントを作成' }).first()).toBeVisible();
});

test('guest settings is gated and the legacy dashboard anchor redirects to localized settings', async ({
  page,
}) => {
  await page.goto('/ja/account/settings/');
  await expect(page).toHaveURL(/\/ja\/account\/settings\/$/);
  await expect(page.getByRole('heading', { name: 'アカウント設定' })).toBeVisible();
  const main = page.getByRole('main');
  await expect(main.getByRole('link', { name: 'ログイン', exact: true })).toHaveAttribute(
    'href',
    '/ja/login/',
  );
  await expect(main.getByRole('button', { name: '連携解除' })).toHaveCount(0);
  await expect(main.getByRole('button', { name: 'アカウントを削除' })).toHaveCount(0);

  await page.goto('/ja/dashboard/#account-settings');
  await expect(page).toHaveURL(/\/ja\/account\/settings\/$/);
  await expect(page.getByRole('heading', { name: 'アカウント設定' })).toBeVisible();
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
