import { AuthClient } from '@supabase/auth-js';

const clients = new Map<string, InstanceType<typeof AuthClient>>();

export function createAuthClient(configuration: { url: string; key: string }) {
  const identifier = `${configuration.url}\0${configuration.key}`;
  const existing = clients.get(identifier);
  if (existing) return existing;
  const client = new AuthClient({
    url: `${configuration.url}/auth/v1`,
    headers: { apikey: configuration.key, Authorization: `Bearer ${configuration.key}` },
    storageKey: 'kaq.auth.v1',
    flowType: 'pkce',
    detectSessionInUrl: false,
    autoRefreshToken: true,
    persistSession: true,
  });
  clients.set(identifier, client);
  return client;
}
