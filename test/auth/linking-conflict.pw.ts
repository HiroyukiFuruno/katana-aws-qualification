import { expect, test, type Page } from '@playwright/test';
import { signIn } from './helpers';
import { authOrigin, testKey } from './settings';

const alternate = {
  id: 'alternate',
  backend: 'keycloak',
  name: 'Alternate',
  scopes: 'openid email profile',
};

async function alternateUrl(page: Page, action: 'signIn' | 'link') {
  return page.evaluate(
    async ({ origin, key, provider, operation }) => {
      const clientModule = '/src/auth/client.ts';
      const adapterModule = '/src/auth/SupabaseAuth.ts';
      const { createAuthClient } = await import(clientModule);
      const { SupabaseAuth } = await import(adapterModule);
      const service = new SupabaseAuth(
        createAuthClient({ url: origin, key }),
        [provider],
        location.origin,
      );
      return operation === 'link'
        ? service.linkIdentity(provider.id, 'ja')
        : service.signIn(provider.id, 'ja');
    },
    { origin: authOrigin, key: testKey('anon'), provider: alternate, operation: action },
  );
}

async function signInAtIdp(page: Page, url: string, username: string) {
  await page.goto(url);
  await page.getByLabel('Username or email').fill(username);
  await page.getByLabel('Password', { exact: true }).fill('integration-only');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
}

test('a linked identity conflict keeps the existing account and offers its dashboard', async ({
  browser,
  page,
}) => {
  const anonymous = await browser.newPage();
  await anonymous.goto('/ja/auth/callback/?error_code=identity_already_exists');
  await expect(anonymous.locator('[data-auth-failure="identity-conflict"]')).toBeVisible();
  await expect(anonymous.locator('main').getByRole('link', { name: 'ログイン' })).toBeVisible();
  await expect(anonymous.getByRole('link', { name: 'ダッシュボード' })).toHaveCount(0);
  await anonymous.close();

  const owner = await browser.newPage();
  await signIn(owner, 'other');
  await owner.close();

  await signIn(page, 'learner');
  const original = await page.evaluate(
    () => JSON.parse(localStorage.getItem('kaq.auth.v1') ?? '{}').user.id,
  );
  const conflictingLink = await alternateUrl(page, 'link');
  await page.context().clearCookies();
  await signInAtIdp(page, conflictingLink, 'other');

  const failure = page.locator('[data-auth-failure="identity-conflict"]');
  await expect(failure).toHaveText('このログイン方法は別のKAQアカウントへ連携済みです。');
  await expect(failure).not.toContainText('other@example.test');
  await expect(failure).not.toContainText('Identity is already linked');
  await expect(page.getByRole('link', { name: 'ダッシュボード' })).toBeVisible();
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('kaq.auth.v1') ?? '{}').user.id),
  ).toBe(original);
  await page.getByRole('link', { name: 'ダッシュボード' }).click();
  await expect(page).toHaveURL(/\/ja\/dashboard\/$/);
  await expect(page.getByRole('heading', { name: 'ダッシュボード', exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('kaq.auth.v1') ?? '{}').user.id),
  ).toBe(original);
});
