import { expect, mock, test } from 'bun:test';
import type { GoTrueClient } from '@supabase/auth-js';
import { callbackFailureKind } from '../src/auth/callbackFailure';
import { configuredProviders } from '../src/auth/config';
import { SupabaseAuth } from '../src/auth/SupabaseAuth';

test('Google uses the common provider registry and basic profile scopes only', () => {
  const google = configuredProviders({ google: true }).find((provider) => provider.id === 'google');
  expect(google).toEqual({
    id: 'google',
    backend: 'google',
    name: 'Google',
    scopes: 'openid profile email',
  });
});

test('Google configuration is independent of GitHub and absent flags stay disabled', () => {
  expect(configuredProviders({ github: false, google: true }).map((provider) => provider.id)).toEqual([
    'google',
  ]);
  expect(configuredProviders({ github: true, google: true }).map((provider) => provider.id)).toEqual([
    'github',
    'google',
  ]);
  expect(configuredProviders({ google: false })).toEqual([]);
});

test('Microsoft uses Azure without mail or storage scopes and stays independently disabled', () => {
  const microsoft = configuredProviders({ microsoft: true }).find(
    (provider) => provider.id === 'microsoft',
  );
  expect(microsoft).toEqual({
    id: 'microsoft',
    backend: 'azure',
    name: 'Microsoft',
    scopes: 'openid profile email',
  });
  expect(configuredProviders({ github: true, microsoft: true }).map((provider) => provider.id)).toEqual([
    'github',
    'microsoft',
  ]);
  expect(configuredProviders({ microsoft: false })).toEqual([]);
});

test('Facebook is opt-in and requests only basic profile and email access', () => {
  expect(configuredProviders({ facebook: true })).toEqual([
    { id: 'facebook', backend: 'facebook', name: 'Facebook', scopes: 'email public_profile' },
  ]);
  expect(configuredProviders({ github: true, facebook: false }).map((provider) => provider.id)).toEqual([
    'github',
  ]);
  expect(configuredProviders({ github: false, facebook: true }).map((provider) => provider.id)).toEqual([
    'facebook',
  ]);
  expect(configuredProviders({})).toEqual([]);
});

test('Facebook sign-in and linking send the registered backend and scopes to the SDK', async () => {
  const signInWithOAuth = mock(async () => ({
    data: { url: 'https://example.test/signin' },
    error: null,
  }));
  const linkIdentity = mock(async () => ({ data: { url: 'https://example.test/link' }, error: null }));
  const client = {
    signInWithOAuth,
    linkIdentity,
    getSession: async () => ({ data: { session: {} }, error: null }),
    getUser: async () => ({
      data: { user: { id: 'user', aud: 'authenticated', app_metadata: {}, user_metadata: {} } },
      error: null,
    }),
  } as unknown as GoTrueClient;
  const auth = new SupabaseAuth(client, configuredProviders({ facebook: true }), 'https://app.example');
  const options = {
    provider: 'facebook',
    options: {
      scopes: 'email public_profile',
      redirectTo: 'https://app.example/ja/auth/callback/',
      skipBrowserRedirect: true,
    },
  };
  await auth.signIn('facebook', 'ja');
  await auth.linkIdentity('facebook', 'ja');
  expect(signInWithOAuth).toHaveBeenCalledWith(options);
  expect(linkIdentity).toHaveBeenCalledWith(options);
});

test('a Facebook missing-email failure remains a safe generic callback failure', () => {
  expect(
    callbackFailureKind(null, '?error=server_error&error_description=Facebook%20email%20missing'),
  ).toBe('unknown');
});
