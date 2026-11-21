import { expect, test } from '@playwright/test';
import { localePath, locales } from '../../src/locales';
import { authorizationUrl, signIn } from './helpers';
import { authOrigin } from './settings';

for (const locale of locales) {
  test(`real OAuth returns to the ${locale} dashboard`, async ({ page }) => {
    await page.goto(localePath(locale, 'login'));
    await page.goto(await authorizationUrl(page, locale));
    await page.getByLabel('Username or email').fill('learner');
    await page.getByLabel('Password', { exact: true }).fill('integration-only');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await expect(page).toHaveURL(`http://127.0.0.1:5173${localePath(locale, 'dashboard')}`);
    await page.goto(localePath(locale, 'account/settings'));
    await expect(page.getByText('learner@example.test', { exact: true })).toBeVisible();
  });
}

test('signing out clears the authenticated display in another open tab', async ({ page }) => {
  await signIn(page);
  await page.goto('/ja/account/settings/');
  const otherTab = await page.context().newPage();
  await otherTab.goto('/ja/account/settings/');
  await expect(otherTab.getByText('learner@example.test', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'ログアウト', exact: true }).click();
  await expect(otherTab.getByText('learner@example.test', { exact: true })).toHaveCount(0);
  await expect(otherTab.getByRole('main').getByRole('link', { name: 'ログイン' })).toBeVisible();
  await otherTab.goto('/ja/dashboard/');
  await expect(otherTab.getByText('ゲスト・この端末の記録', { exact: true })).toBeVisible();
  await expect(otherTab.getByRole('link', { name: '無料アカウントを作成', exact: true })).toBeVisible();
});

test('an expired cached session with a revoked refresh token cannot restore an account', async ({
  page,
  request,
}) => {
  await signIn(page);
  const token = await page.evaluate(
    () => JSON.parse(localStorage.getItem('kaq.auth.v1') ?? '{}').access_token,
  );
  const logout = await request.post(`${authOrigin}/auth/v1/logout?scope=global`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(logout.ok()).toBe(true);
  await page.evaluate(() => {
    const cached = JSON.parse(localStorage.getItem('kaq.auth.v1') ?? '{}');
    cached.expires_at = 1;
    localStorage.setItem('kaq.auth.v1', JSON.stringify(cached));
  });
  await page.reload();
  await expect(page.getByText('learner@example.test', { exact: true })).toHaveCount(0);
  await expect(page.getByText('ゲスト・この端末の記録', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: '無料アカウントを作成', exact: true })).toBeVisible();
});
