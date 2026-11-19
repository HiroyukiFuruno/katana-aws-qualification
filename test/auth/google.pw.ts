import { type APIRequestContext, expect, test } from '@playwright/test';
import { signIn } from './helpers';
import { authOrigin } from './settings';

async function googleTarget(url: string, request: APIRequestContext) {
  if (new URL(url).hostname === 'accounts.google.com') return new URL(url);
  const result = await request.get(url, { maxRedirects: 0 });
  expect(result.status()).toBe(302);
  return new URL(result.headers().location);
}

function verifyGoogle(target: URL) {
  expect(target.hostname).toBe('accounts.google.com');
  expect(target.searchParams.get('client_id')).toBe('integration-google.apps.googleusercontent.com');
  expect(target.searchParams.get('redirect_uri')).toBe(`${authOrigin}/auth/v1/callback`);
  expect(target.searchParams.get('response_type')).toBe('code');
  expect(new Set(target.searchParams.get('scope')?.split(' '))).toEqual(
    new Set(['openid', 'email', 'profile']),
  );
  expect(target.searchParams.has('state')).toBe(true);
}

test('Google enrollment shares the PKCE callback and requests only identity scopes', async ({
  page,
  request,
}) => {
  await page.goto('/ja/login/');
  await expect(page.getByRole('button', { name: 'Googleでログイン' })).toBeVisible();
  const url = await page.evaluate(async () => {
    const module = '/src/auth/runtime.ts';
    const { createAccountAuth } = await import(module);
    return createAccountAuth().signIn('google', 'ja');
  });
  const authorize = new URL(url);
  expect(authorize.searchParams.get('redirect_to')).toBe('http://127.0.0.1:5173/ja/auth/callback/');
  expect(authorize.searchParams.get('code_challenge_method')).toBe('s256');
  expect(authorize.searchParams.get('code_challenge')).toBeTruthy();
  verifyGoogle(await googleTarget(url, request));
});

test('an authenticated account can initiate verified Google identity linking', async ({
  page,
  request,
}) => {
  await signIn(page);
  const url = await page.evaluate(async () => {
    const module = '/src/auth/runtime.ts';
    const { createAccountAuth } = await import(module);
    return createAccountAuth().linkIdentity('google', 'ja');
  });
  verifyGoogle(await googleTarget(url, request));
});
