import { expect, test } from 'bun:test';
import type { User } from '@supabase/auth-js';
import { accountFrom } from '../src/auth/account';

const user: User = {
  id: 'profile-user',
  aud: 'authenticated',
  created_at: '2026-11-20T00:00:00Z',
  app_metadata: {},
  user_metadata: {},
};

test('verified account profiles accept provider avatars and keep a fallback for missing attributes', () => {
  expect(accountFrom(user)).toMatchObject({ id: user.id, email: '', identities: [] });
  expect(
    accountFrom({ ...user, user_metadata: { name: ' Learner ', picture: 'https://avatar.example/me' } }),
  ).toMatchObject({ displayName: 'Learner', avatarUrl: 'https://avatar.example/me' });
});

test('avatar URLs never accept executable, plaintext or embedded-credential URLs', () => {
  for (const avatar of [
    'javascript:alert(1)',
    'data:image/svg+xml,test',
    'http://avatar.example',
    'https://user:secret@avatar.example/me',
    'not a URL',
    42,
  ]) {
    expect(accountFrom({ ...user, user_metadata: { avatar_url: avatar } }).avatarUrl).toBeUndefined();
  }
});
