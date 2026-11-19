import { expect, test } from '@playwright/test';
import { signIn } from './helpers';
import { authOrigin, testKey } from './settings';

test('custom provider administration rejects private issuer addresses', async ({ request }) => {
  const result = await request.post(`${authOrigin}/auth/v1/admin/custom-providers`, {
    headers: { Authorization: `Bearer ${testKey('service_role')}` },
    data: {
      provider_type: 'oidc',
      identifier: 'custom:integration',
      name: 'Integration OIDC',
      issuer: 'https://kaq-idp:54441/realms/kaq',
      client_id: 'kaq',
      client_secret: 'integration-only',
      scopes: ['openid', 'profile', 'email'],
    },
  });
  expect(result.status()).toBe(400);
  expect((await result.json()).msg).toContain('private network');
});

test('linking a second authenticated OIDC identity preserves the account and permits safe unlink', async ({
  page,
}) => {
  await signIn(page);
  const previous = await page.evaluate(
    () => JSON.parse(localStorage.getItem('kaq.auth.v1') ?? '{}').user.id,
  );
  const url = await page.evaluate(
    async ({ origin, key }) => {
      const clientModule = '/src/auth/client.ts';
      const adapterModule = '/src/auth/SupabaseAuth.ts';
      const { createAuthClient } = await import(clientModule);
      const { SupabaseAuth } = await import(adapterModule);
      const provider = {
        id: 'alternate',
        backend: 'keycloak',
        name: 'Alternate',
        scopes: 'openid email profile',
      };
      const service = new SupabaseAuth(
        createAuthClient({ url: origin, key }),
        [provider],
        location.origin,
      );
      return service.linkIdentity('alternate', 'ja');
    },
    { origin: authOrigin, key: testKey('anon') },
  );
  await page.context().clearCookies();
  await page.goto(url);
  await page.getByLabel('Username or email').fill('linked');
  await page.getByLabel('Password', { exact: true }).fill('integration-only');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL(/\/ja\/dashboard\/$/);
  await expect(page.getByRole('button', { name: '連携解除', exact: true })).toHaveCount(2);
  const current = await page.evaluate(
    () => JSON.parse(localStorage.getItem('kaq.auth.v1') ?? '{}').user.id,
  );
  expect(current).toBe(previous);
  await page.getByRole('button', { name: '連携解除', exact: true }).last().click();
  await expect(page.getByRole('button', { name: '連携解除', exact: true })).toHaveCount(1);
  await expect(page.getByRole('button', { name: '連携解除', exact: true })).toBeDisabled();
});

test('a consumed authorization code cannot be exchanged again', async ({ page }) => {
  let callback = '';
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname === '/ja/auth/callback/' && url.searchParams.has('code')) callback = url.href;
  });
  await signIn(page);
  expect(callback).toBeTruthy();
  await page.goto(callback);
  await expect(page.getByRole('alert')).toContainText('もう一度ログイン');
  await expect(page).toHaveURL(/\/ja\/auth\/callback\/$/);
});
