import { expect, type Page } from '@playwright/test';
import { authOrigin, integrationProvider, testKey } from './settings';

export type RealSession = { accessToken: string; refreshToken: string; userId: string };

export async function signIn(page: Page, username: string) {
  await page.goto('/ja/login/');
  const authorizationUrl = await page.evaluate(
    async ({ origin, key, provider }) => {
      const clientModule = '/src/auth/client.ts';
      const adapterModule = '/src/auth/SupabaseAuth.ts';
      const { createAuthClient } = await import(clientModule);
      const { SupabaseAuth } = await import(adapterModule);
      return new SupabaseAuth(
        createAuthClient({ url: origin, key }),
        [provider],
        location.origin,
      ).signIn(provider.id, 'ja');
    },
    { origin: authOrigin, key: testKey('anon'), provider: integrationProvider },
  );
  await page.goto(authorizationUrl);
  await page.getByLabel('Username or email').fill(username);
  await page.getByLabel('Password', { exact: true }).fill('integration-only');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL(/\/ja\/dashboard\/$/);
}

export async function activeSession(page: Page): Promise<RealSession> {
  return page.evaluate(
    async ({ origin, key }) => {
      const { createAuthClient } = await import('/src/auth/client.ts');
      const { data, error } = await createAuthClient({ url: origin, key }).getSession();
      if (error || !data.session) throw error ?? new Error('Missing session');
      return {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        userId: data.session.user.id,
      };
    },
    { origin: authOrigin, key: testKey('anon') },
  );
}

export async function setSession(page: Page, session: RealSession) {
  await page.evaluate(
    async ({ origin, key, value }) => {
      const { createAuthClient } = await import('/src/auth/client.ts');
      const { error } = await createAuthClient({ url: origin, key }).setSession({
        access_token: value.accessToken,
        refresh_token: value.refreshToken,
      });
      if (error) throw error;
    },
    { origin: authOrigin, key: testKey('anon'), value: session },
  );
}
