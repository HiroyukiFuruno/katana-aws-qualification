import { type APIRequestContext, expect, test } from '@playwright/test';
import { signIn } from './helpers';
import { authOrigin } from './settings';

async function facebookTarget(url: string, request: APIRequestContext) {
  if (new URL(url).hostname === 'www.facebook.com') return new URL(url);
  const result = await request.get(url, { maxRedirects: 0 });
  expect(result.status()).toBe(302);
  return new URL(result.headers().location);
}

function verifyFacebook(target: URL) {
  expect(target.hostname).toBe('www.facebook.com');
  expect(target.pathname).toMatch(/\/dialog\/oauth$/);
  expect(target.searchParams.get('client_id')).toBe('integration-facebook-client');
  expect(target.searchParams.get('redirect_uri')).toBe(`${authOrigin}/auth/v1/callback`);
  expect(target.searchParams.get('response_type')).toBe('code');
  expect(new Set(target.searchParams.get('scope')?.split(/[ ,]+/))).toEqual(
    new Set(['email', 'public_profile']),
  );
  expect(target.searchParams.get('state')).toBeTruthy();
}

test('Facebook enrollment starts GoTrue OAuth with PKCE and minimal scopes', async ({
  page,
  request,
}) => {
  await page.goto('/ja/login/');
  await expect(page.getByRole('button', { name: 'Facebookでログイン' })).toBeVisible();
  const url = await page.evaluate(async () => {
    const module = '/src/auth/runtime.ts';
    const { createAccountAuth } = await import(module);
    return createAccountAuth().signIn('facebook', 'ja');
  });
  const authorize = new URL(url);
  expect(authorize.searchParams.get('provider')).toBe('facebook');
  expect(authorize.searchParams.get('redirect_to')).toBe('http://127.0.0.1:5173/ja/auth/callback/');
  expect(authorize.searchParams.get('code_challenge_method')).toBe('s256');
  expect(authorize.searchParams.get('code_challenge')).toBeTruthy();
  verifyFacebook(await facebookTarget(url, request));
});

test('an authenticated account can initiate Facebook identity linking', async ({ page, request }) => {
  await signIn(page);
  const url = await page.evaluate(async () => {
    const module = '/src/auth/runtime.ts';
    const { createAccountAuth } = await import(module);
    return createAccountAuth().linkIdentity('facebook', 'ja');
  });
  verifyFacebook(await facebookTarget(url, request));
});
