import { expect, test } from 'bun:test';
import { configuredProviders } from '../src/auth/config';

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
