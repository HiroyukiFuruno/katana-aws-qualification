import { createAuthClient } from './client';
import { authConfiguration, configuredProviders } from './config';
import { SupabaseAuth } from './SupabaseAuth';
import type { AccountAuth } from './types';

export function createAccountAuth(): AccountAuth | null {
  const configuration = authConfiguration({
    url: import.meta.env.VITE_SUPABASE_URL,
    key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  });
  if (!configuration) return null;
  const client = createAuthClient(configuration);
  return new SupabaseAuth(
    client,
    configuredProviders({
      github: import.meta.env.VITE_AUTH_GITHUB_ENABLED === 'true',
      google: import.meta.env.VITE_AUTH_GOOGLE_ENABLED === 'true',
      microsoft: import.meta.env.VITE_AUTH_MICROSOFT_ENABLED === 'true',
      facebook: import.meta.env.VITE_AUTH_FACEBOOK_ENABLED === 'true',
    }),
    location.origin,
  );
}
