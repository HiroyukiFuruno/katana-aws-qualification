import { expect, mock, test } from 'bun:test';
import type { GoTrueClient } from '@supabase/auth-js';
import { SupabaseAuth } from '../src/auth/SupabaseAuth';

function client(
  session: { access_token: string } | null = { access_token: 'user-token' },
  userId = 'user-1',
) {
  return {
    getSession: mock(async () => ({ data: { session }, error: null })),
    getUser: mock(async () => ({ data: { user: { id: userId } }, error: null })),
    signOut: mock(async () => ({ error: null })),
  } as unknown as GoTrueClient;
}

test('deletion sends only the bearer token and signs out locally after server confirmation', async () => {
  const fake = client();
  const request = mock(async () => new Response(null, { status: 204 }));
  const original = globalThis.fetch;
  globalThis.fetch = request as unknown as typeof fetch;
  try {
    const auth = new SupabaseAuth(fake, [], 'https://app.example', {
      url: 'https://functions.example/delete-account',
      key: 'public-function-key',
    });
    await auth.deleteAccount('user-1');
    expect(request).toHaveBeenCalledWith(new URL('https://functions.example/delete-account'), {
      method: 'POST',
      headers: { Authorization: 'Bearer user-token', apikey: 'public-function-key' },
    });
    expect(fake.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(fake.getUser).toHaveBeenCalledWith('user-token');
  } finally {
    globalThis.fetch = original;
  }
});

test('deletion does not call a backend without a configured session and backend', async () => {
  const fake = client();
  const missingBackend = new SupabaseAuth(fake, [], 'https://app.example');
  await expect(missingBackend.deleteAccount('user-1')).rejects.toThrow(
    'Account deletion is unavailable',
  );
  const missingSession = client(null);
  const auth = new SupabaseAuth(missingSession, [], 'https://app.example', {
    url: 'https://functions.example/delete-account',
    key: 'public-function-key',
  });
  await expect(auth.deleteAccount('user-1')).rejects.toThrow('Authentication required');
});

test('deletion rejects a switched account before making a deletion request', async () => {
  const fake = client({ access_token: 'user-token' }, 'user-2');
  const request = mock(async () => new Response(null, { status: 204 }));
  const original = globalThis.fetch;
  globalThis.fetch = request as unknown as typeof fetch;
  try {
    const auth = new SupabaseAuth(fake, [], 'https://app.example', {
      url: 'https://functions.example/delete-account',
      key: 'public-function-key',
    });
    await expect(auth.deleteAccount('user-1')).rejects.toThrow('Account changed');
    expect(request).not.toHaveBeenCalled();
    expect(fake.signOut).not.toHaveBeenCalled();
  } finally {
    globalThis.fetch = original;
  }
});
