import { expect, test } from '@playwright/test';
import { authOrigin, testKey } from './settings';

test('Auth rejects every non-SSO public entry while keeping OAuth registration enabled', async ({
  request,
}) => {
  const base = `${authOrigin}/auth/v1`;
  const headers = { apikey: testKey('anon'), Authorization: `Bearer ${testKey('anon')}` };
  const settings = await (await request.get(`${base}/settings`, { headers })).json();
  expect(settings.disable_signup).toBe(false);
  expect(settings.external.email).toBe(false);
  expect(settings.external.phone).toBe(false);
  expect(settings.external.anonymous_users).toBe(false);
  for (const [path, data] of [
    ['/signup', { email: 'blocked@example.test', password: 'must-not-register' }],
    ['/signup', {}],
    ['/signup', { phone: '+15555550100', password: 'must-not-register' }],
    ['/otp', { email: 'blocked@example.test' }],
    ['/otp', { phone: '+15555550100' }],
    ['/recover', { email: 'blocked@example.test' }],
    ['/token?grant_type=password', { email: 'blocked@example.test', password: 'must-not-register' }],
  ] as const) {
    const result = await request.post(base + path, { headers, data });
    expect(result.status(), path).toBeGreaterThanOrEqual(400);
    expect(result.status(), path).toBeLessThan(500);
  }
});

test('GitHub initiation uses the configured client, minimal scopes and the Auth callback', async ({
  page,
  request,
}) => {
  await page.goto('/ja/login/');
  await expect(page.getByRole('button', { name: 'GitHubでログイン' })).toBeVisible();
  const authorize = await page.evaluate(async () => {
    const module = '/src/auth/runtime.ts';
    const { createAccountAuth } = await import(module);
    return createAccountAuth().signIn('github', 'ja');
  });
  const result = await request.get(authorize, { maxRedirects: 0 });
  expect(result.status()).toBe(302);
  const target = new URL(result.headers().location);
  expect(target.origin).toBe('https://github.com');
  expect(target.pathname).toBe('/login/oauth/authorize');
  expect(target.searchParams.get('client_id')).toBe('integration-redirect-check');
  expect(target.searchParams.get('redirect_uri')).toBe(`${authOrigin}/auth/v1/callback`);
  expect(target.searchParams.get('scope')).toContain('user:email');
  expect(target.searchParams.get('scope')).not.toContain('repo');
  expect(target.searchParams.has('state')).toBe(true);
});
