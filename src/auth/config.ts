import type { AuthProvider } from './types';

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

export function configuredProviders(enabled: boolean): readonly AuthProvider[] {
  return enabled
    ? [{ id: 'github', backend: 'github', name: 'GitHub', scopes: 'read:user user:email' }]
    : [];
}
