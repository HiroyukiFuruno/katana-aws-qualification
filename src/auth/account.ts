import type { User } from '@supabase/auth-js';
import { httpsImageSource } from '../images/catalog';
import type { Account } from './types';

function profileText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function accountFrom(user: User): Account {
  if (user.is_anonymous) throw new Error('Anonymous authentication is disabled');
  const metadata: unknown = user.user_metadata;
  const profile = metadata && typeof metadata === 'object' ? metadata : {};
  const displayName =
    profileText(Reflect.get(profile, 'full_name')) ?? profileText(Reflect.get(profile, 'name'));
  return {
    id: user.id,
    email: user.email ?? '',
    displayName,
    avatarUrl: httpsImageSource(Reflect.get(profile, 'avatar_url') ?? Reflect.get(profile, 'picture')),
    identities: (user.identities ?? []).map((identity) => ({
      id: identity.identity_id,
      provider: identity.provider,
    })),
  };
}
