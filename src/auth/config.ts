import type { AuthProvider } from './types';
import definitions from './providers.json';

export function authConfiguration(input: { url?: string; key?: string }) {
  if (!input.url && !input.key) return null;
  if (!input.url || !input.key) throw new Error('Incomplete authentication configuration');
  const url = new URL(input.url);
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (
    (url.protocol !== 'https:' && !(loopback && url.protocol === 'http:')) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  )
    throw new Error('Invalid authentication URL');
  if (!input.key.startsWith('sb_publishable_')) {
    const claims: unknown = JSON.parse(atob(input.key.split('.')[1] ?? ''));
    if (!claims || typeof claims !== 'object' || !('role' in claims) || claims.role !== 'anon') {
      throw new Error('Authentication requires a public key');
    }
  }
  return { url: url.origin, key: input.key };
}

export function configuredProviders(
  enabled: Partial<Record<'github' | 'google' | 'microsoft' | 'facebook', boolean>>,
): readonly AuthProvider[] {
  const providers = definitions as readonly AuthProvider[];
  const flags = new Map(Object.entries(enabled));
  return providers.filter((provider) => flags.get(provider.id) === true);
}
