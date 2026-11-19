import { expect, mock, spyOn, test } from 'bun:test';
import type { GoTrueClient, User } from '@supabase/auth-js';
import { SupabaseAuth } from '../src/auth/SupabaseAuth';
import type { AuthProvider } from '../src/auth/types';

const providers: readonly AuthProvider[] = [
  { id: 'github', backend: 'github', name: 'GitHub', scopes: 'read:user' },
];
const identity = { id: 'identity-1', provider: 'github' };
const user: User = {
  id: 'user-1',
  email: 'user@example.test',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: '2026-01-01T00:00:00Z',
  identities: [{ id: 'identity-1', user_id: 'user-1', identity_id: 'identity-1', provider: 'github' }],
};
const authError = new Error('SDK failure');

function client() {
  return {
    getSession: mock(async () => ({ data: { session: { user } }, error: null })),
    getUser: mock(async () => ({ data: { user }, error: null })),
    signInWithOAuth: mock(async () => ({
      data: { url: 'https://oauth.example/authorize' },
      error: null,
    })),
    exchangeCodeForSession: mock(async () => ({ data: { user }, error: null })),
    refreshSession: mock(async () => ({ data: { user }, error: null })),
    signOut: mock(async () => ({ error: null })),
    linkIdentity: mock(async () => ({ data: { url: 'https://oauth.example/link' }, error: null })),
    unlinkIdentity: mock(async () => ({ data: {}, error: null })),
  } as unknown as GoTrueClient;
}

function service(fake = client()) {
  return { auth: new SupabaseAuth(fake, providers, 'https://app.example'), fake };
}

test('signIn passes provider, locale callback, scopes, and browser redirect option', async () => {
  const { auth, fake } = service();
  const result = await auth.signIn('github', 'ja');
  expect(result).toBe('https://oauth.example/authorize');
  expect(spyOn(fake, 'signInWithOAuth')).toHaveBeenCalledWith({
    provider: 'github',
    options: {
      scopes: 'read:user',
      redirectTo: 'https://app.example/ja/auth/callback/',
      skipBrowserRedirect: true,
    },
  });
});

test('signIn rejects unavailable providers, SDK errors, and missing URLs', async () => {
  const { auth, fake } = service();
  await expect(auth.signIn('google', 'en')).rejects.toThrow('Provider is not available');
  spyOn(fake, 'signInWithOAuth').mockResolvedValue({ data: { url: '' }, error: null });
  await expect(auth.signIn('github', 'en')).rejects.toThrow('Missing authorization URL');
  spyOn(fake, 'signInWithOAuth').mockResolvedValue({ data: { url: null }, error: authError });
  await expect(auth.signIn('github', 'en')).rejects.toBe(authError);
});

test('callback exchanges one code and returns the verified account', async () => {
  const { auth, fake } = service();
  await expect(auth.completeCallback('?code=once')).resolves.toMatchObject({
    id: 'user-1',
    identities: [identity],
  });
  expect(spyOn(fake, 'exchangeCodeForSession')).toHaveBeenCalledWith('once');
  spyOn(fake, 'exchangeCodeForSession').mockResolvedValue({ data: { user: null }, error: authError });
  await expect(auth.completeCallback('?code=once')).rejects.toBe(authError);
  await expect(auth.completeCallback('?code=a&code=b')).rejects.toThrow(
    'Invalid authentication callback',
  );
});

test('callback and account verification surface SDK errors and invalid users', async () => {
  const { auth, fake } = service();
  spyOn(fake, 'exchangeCodeForSession').mockResolvedValue({ data: { user: null }, error: null });
  await expect(auth.completeCallback('?code=once')).rejects.toThrow('Missing authenticated user');
  spyOn(fake, 'getSession').mockResolvedValue({ data: { session: null }, error: null });
  await expect(auth.getAccount()).resolves.toBeNull();
  spyOn(fake, 'getSession').mockResolvedValue({ data: { session: { user } }, error: authError });
  await expect(auth.getAccount()).rejects.toBe(authError);
  spyOn(fake, 'getSession').mockResolvedValue({ data: { session: { user } }, error: null });
  spyOn(fake, 'getUser').mockResolvedValue({
    data: { user: { ...user, is_anonymous: true } },
    error: null,
  });
  await expect(auth.getAccount()).rejects.toThrow('Anonymous authentication is disabled');
  spyOn(fake, 'getUser').mockResolvedValue({ data: { user }, error: authError });
  await expect(auth.getAccount()).rejects.toBe(authError);
});

test('refresh and logout propagate SDK failures', async () => {
  const { auth, fake } = service();
  spyOn(fake, 'refreshSession').mockResolvedValue({ data: { user: null }, error: null });
  await expect(auth.refresh()).resolves.toBeNull();
  spyOn(fake, 'refreshSession').mockResolvedValue({ data: { user }, error: authError });
  await expect(auth.refresh()).rejects.toBe(authError);
  spyOn(fake, 'signOut').mockResolvedValue({ error: authError });
  await expect(auth.signOut()).rejects.toBe(authError);
});

test('unlink requires an owned identity and at least two identities, then calls SDK', async () => {
  const { auth, fake } = service();
  await expect(auth.unlinkIdentity('identity-1')).rejects.toThrow('Keep one sign-in method');
  const identities = user.identities ?? [];
  spyOn(fake, 'getUser').mockResolvedValue({
    data: {
      user: {
        ...user,
        identities: [...identities, { ...identities[0], id: 'identity-2', identity_id: 'identity-2' }],
      },
    },
    error: null,
  });
  await expect(auth.unlinkIdentity('missing')).rejects.toThrow(
    'Identity does not belong to this account',
  );
  await expect(auth.unlinkIdentity('identity-1')).resolves.toBeUndefined();
  expect(spyOn(fake, 'unlinkIdentity')).toHaveBeenCalledWith(
    expect.objectContaining({ identity_id: 'identity-1' }),
  );
  spyOn(fake, 'unlinkIdentity').mockResolvedValue({ data: null, error: authError });
  await expect(auth.unlinkIdentity('identity-1')).rejects.toBe(authError);
});

test('linkIdentity verifies the current account before starting OAuth', async () => {
  const { auth, fake } = service();
  spyOn(fake, 'getSession').mockResolvedValue({ data: { session: null }, error: null });
  await expect(auth.linkIdentity('github', 'en')).rejects.toThrow('Authentication required');
  spyOn(fake, 'getSession').mockResolvedValue({ data: { session: { user } }, error: null });
  await expect(auth.linkIdentity('github', 'en')).resolves.toBe('https://oauth.example/link');
});
