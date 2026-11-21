import { expect, test } from 'bun:test';
import { authConfiguration, configuredProviders } from '../src/auth/config';
import { callbackCode, callbackPath, dashboardPath } from '../src/auth/navigation';
import { localePath, locales } from '../src/locales';
import { publishedPages, routeAt } from '../src/routes';

test('auth configuration fails closed and accepts only public HTTPS service URLs', () => {
  expect(authConfiguration({})).toBeNull();
  expect(() => authConfiguration({ url: 'https://auth.example', key: '' })).toThrow();
  expect(() => authConfiguration({ url: 'http://auth.example', key: 'public-key' })).toThrow();
  expect(() => authConfiguration({ url: 'https://user:secret@auth.example', key: 'key' })).toThrow();
  expect(authConfiguration({ url: 'https://auth.example', key: 'sb_publishable_test' })?.url).toBe(
    'https://auth.example',
  );
});

test('unconfigured providers are excluded while GitHub keeps the shared registry', () => {
  expect(configuredProviders({})).toEqual([]);
  const providers = configuredProviders({ github: true });
  expect(providers.map((provider) => provider.id)).toEqual(['github']);
  expect(providers[0].backend).toBe('github');
});

test('callback accepts one authorization code, rejects errors and ambiguous parameters', () => {
  expect(callbackCode('?code=once')).toBe('once');
  for (const query of ['', '?code=', '?code=a&code=b', '?error=access_denied', '?code=a&error=x']) {
    expect(() => callbackCode(query)).toThrow();
  }
  expect(callbackPath('ja')).toBe('/ja/auth/callback/');
  expect(dashboardPath('en')).toBe('/dashboard/');
});

test('auth routes resolve in every locale without entering the public sitemap list', () => {
  for (const page of ['login', 'auth/callback', 'dashboard', 'account/settings']) {
    expect(publishedPages).not.toContain(page);
    for (const locale of locales) {
      expect(routeAt(localePath(locale, page))).toEqual({ locale, page });
    }
  }
  expect(routeAt('/ja/auth/callback/extra/')).toBeUndefined();
});

test('the local Auth configuration permits every supported locale callback and disables non-SSO signup', async () => {
  const config = Bun.TOML.parse(await Bun.file('supabase/config.toml').text()) as {
    auth: {
      additional_redirect_urls: string[];
      enable_signup: boolean;
      enable_anonymous_sign_ins: boolean;
      email: { enable_signup: boolean };
      sms: { enable_signup: boolean };
    };
  };
  expect(config.auth.additional_redirect_urls.sort()).toEqual(
    locales.map((locale) => `http://127.0.0.1:5173${callbackPath(locale)}`).sort(),
  );
  expect(config.auth.enable_signup).toBe(true);
  expect(config.auth.enable_anonymous_sign_ins).toBe(false);
  expect(config.auth.email.enable_signup).toBe(false);
  expect(config.auth.sms.enable_signup).toBe(false);
});
