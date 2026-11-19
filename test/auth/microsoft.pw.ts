import { type APIRequestContext, expect, test } from '@playwright/test';
import { signIn } from './helpers';
import { authOrigin } from './settings';

async function microsoftTarget(url: string, request: APIRequestContext) {
  if (new URL(url).hostname === 'login.microsoftonline.com') return new URL(url);
  const result = await request.get(url, { maxRedirects: 0 });
  expect(result.status()).toBe(302);
  return new URL(result.headers().location);
}

function verifyMicrosoft(target: URL) {
  expect(target.hostname).toBe('login.microsoftonline.com');
  expect(target.pathname).toBe('/common/oauth2/v2.0/authorize');
  expect(target.searchParams.get('client_id')).toBe('11111111-1111-1111-1111-111111111111');
  expect(target.searchParams.get('redirect_uri')).toBe(`${authOrigin}/auth/v1/callback`);
  expect(target.searchParams.get('response_type')).toBe('code');
  expect(new Set(target.searchParams.get('scope')?.split(' '))).toEqual(
    new Set(['openid', 'email', 'profile']),
  );
  expect(target.searchParams.has('state')).toBe(true);
}

test('Microsoft enrollment shares the PKCE callback and uses the common tenant', async ({
  page,
  request,
}) => {
  await page.goto('/ja/login/');
  await expect(page.getByRole('button', { name: 'Microsoftでログイン' })).toBeVisible();
  await expect(
    page.getByText('職場・学校アカウントでは、組織管理者の承認が必要になる場合があります。'),
  ).toBeVisible();
  const url = await page.evaluate(async () => {
    const module = '/src/auth/runtime.ts';
    const { createAccountAuth } = await import(module);
    return createAccountAuth().signIn('microsoft', 'ja');
  });
  const authorize = new URL(url);
  expect(authorize.searchParams.get('redirect_to')).toBe('http://127.0.0.1:5173/ja/auth/callback/');
  expect(authorize.searchParams.get('code_challenge_method')).toBe('s256');
  expect(authorize.searchParams.get('code_challenge')).toBeTruthy();
  verifyMicrosoft(await microsoftTarget(url, request));
});

test('an authenticated account can initiate verified Microsoft identity linking', async ({
  page,
  request,
}) => {
  await signIn(page);
  const url = await page.evaluate(async () => {
    const module = '/src/auth/runtime.ts';
    const { createAccountAuth } = await import(module);
    return createAccountAuth().linkIdentity('microsoft', 'ja');
  });
  verifyMicrosoft(await microsoftTarget(url, request));
});
