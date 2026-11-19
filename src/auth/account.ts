import type { User } from '@supabase/auth-js';
import type { Account } from './types';

export function accountFrom(user: User): Account {
  if (user.is_anonymous) throw new Error('Anonymous authentication is disabled');
  return {
    id: user.id,
    email: user.email ?? '',
    identities: (user.identities ?? []).map((identity) => ({
      id: identity.identity_id,
      provider: identity.provider,
    })),
  };
}
