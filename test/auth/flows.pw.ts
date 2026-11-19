import { expect, test } from '@playwright/test';
import { runAdapter, signIn } from './helpers';

test('real OIDC sign-in, verified session, reload, refresh, home and sign-out', async ({ page }) => {
  await signIn(page);
  await expect(page.getByText('learner@example.test', { exact: true })).toBeVisible();
  const account = await runAdapter<{ id: string }>(page, 'account');
  const refreshed = await runAdapter<{ id: string }>(page, 'refresh');
  expect(refreshed.id).toBe(account.id);
  await page.reload();
  await expect(page.getByText('learner@example.test', { exact: true })).toBeVisible();
  await page.locator('header a.brand').click();
  await expect(page).toHaveURL(/\/ja\/dashboard\/$/);
  await page.getByRole('button', { name: 'ログアウト', exact: true }).click();
  await expect(page).toHaveURL(/\/ja\/$/);
  await page.goto('/ja/dashboard/');
  await expect(page.getByText('learner@example.test', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'GitHubでログイン' })).toBeVisible();
});

test('the last identity cannot be removed and a different user never inherits the previous session', async ({
  page,
}) => {
  await signIn(page);
  expect(await runAdapter<boolean>(page, 'unlinkLast')).toBe(true);
  await expect(page.getByRole('button', { name: '連携解除', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'ログアウト', exact: true }).click();
  await expect(page).toHaveURL(/\/ja\/$/);
  await page.context().clearCookies();
  await signIn(page, 'other');
  await expect(page.getByText('other@example.test', { exact: true })).toBeVisible();
  await expect(page.getByText('learner@example.test', { exact: true })).toHaveCount(0);
});

test('callback rejection cleans code and never loads analytics even with prior consent', async ({
  page,
}) => {
  await page.goto('/ja/login/');
  await page.evaluate(() => localStorage.setItem('katana-aws:analytics-consent', 'granted'));
  await page.goto('/ja/auth/callback/?code=invalid&next=https://example.org');
  await expect(page.locator('[data-auth-failure="browser"]')).toBeVisible();
  await expect(page).toHaveURL(/\/ja\/auth\/callback\/$/);
  await expect(page.locator('#katana-analytics')).toHaveCount(0);
  await page.goto('/ja/auth/callback/?error=access_denied');
  await expect(page.getByRole('alert')).toContainText('もう一度ログイン');
});

test('untrusted cached account data is not rendered when the server rejects its token', async ({
  page,
}) => {
  await page.goto('/ja/login/');
  await page.evaluate(() =>
    localStorage.setItem(
      'kaq.auth.v1',
      JSON.stringify({
        access_token: 'invalid',
        refresh_token: 'invalid',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: 'forged', email: 'forged@example.test' },
        token_type: 'bearer',
      }),
    ),
  );
  await page.goto('/ja/dashboard/');
  await expect(page.getByText('forged@example.test', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'アカウント設定' })).toHaveCount(0);
});
