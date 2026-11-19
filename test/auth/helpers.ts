import { expect, type Page } from '@playwright/test';
import type { Locale } from '../../src/locales';
import { authOrigin, integrationProvider, testKey } from './settings';

export async function authorizationUrl(page: Page, locale: Locale = 'ja') {
  const url = await page.evaluate(
    async ({ origin, key, provider, locale }) => {
      const clientModule = '/src/auth/client.ts';
      const adapterModule = '/src/auth/SupabaseAuth.ts';
      const { createAuthClient } = await import(clientModule);
      const { SupabaseAuth } = await import(adapterModule);
      const auth = new SupabaseAuth(createAuthClient({ url: origin, key }), [provider], location.origin);
      return auth.signIn(provider.id, locale);
    },
    { origin: authOrigin, key: testKey('anon'), provider: integrationProvider, locale },
  );
  return url;
}

export async function signIn(page: Page, username = 'learner') {
  await page.goto('/ja/login/');
  const url = await authorizationUrl(page);
  await page.goto(url);
  await page.getByLabel('Username or email').fill(username);
  await page.getByLabel('Password', { exact: true }).fill('integration-only');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL(/\/ja\/dashboard\/$/);
  await expect(page.getByRole('heading', { name: 'アカウント設定' })).toBeVisible();
}

export async function runAdapter<T>(
  page: Page,
  operation: 'refresh' | 'unlinkLast' | 'account',
): Promise<T> {
  return page.evaluate(
    async ({ origin, key, provider, action }) => {
      const clientModule = '/src/auth/client.ts';
      const adapterModule = '/src/auth/SupabaseAuth.ts';
      const { createAuthClient } = await import(clientModule);
      const { SupabaseAuth } = await import(adapterModule);
      const auth = new SupabaseAuth(createAuthClient({ url: origin, key }), [provider], location.origin);
      if (action === 'refresh') return auth.refresh();
      const account = await auth.getAccount();
      if (action === 'account') return account;
      try {
        await auth.unlinkIdentity(account.identities[0].id);
        return false;
      } catch {
        return true;
      }
    },
    { origin: authOrigin, key: testKey('anon'), provider: integrationProvider, action: operation },
  );
}
