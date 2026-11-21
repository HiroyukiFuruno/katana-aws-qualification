import { AuthClient, type Session } from '@supabase/auth-js';
import type { EncryptedPkceStorage } from '../runtime/pkce-storage.ts';
import type {
  ServerSdkClient,
  ServerSdkLeg,
  ServerSdkOptions,
  ServerSdkResult,
  ServerSdkStatus,
} from './sdk-worker.types.ts';

export function result(
  status: ServerSdkStatus | ServerSdkLeg,
  failure?: ServerSdkResult['failure'],
): ServerSdkResult {
  return {
    legId: 'legId' in status ? status.legId : status.id,
    state: status.state,
    expiresAt: status.expiresAt,
    ...(failure ? { failure } : {}),
  };
}

export function client<Request>(options: ServerSdkOptions<Request>, leg: ServerSdkLeg): ServerSdkClient {
  if (!configuredProvider(options, leg.provider)) throw new Error('provider_not_allowed');
  return new AuthClient({
    url: `${options.url}/auth/v1`,
    headers: { apikey: options.key, Authorization: `Bearer ${options.key}` },
    storage: options.storage(leg),
    storageKey: leg.runtime.storageKey,
    persistSession: true,
    flowType: 'pkce',
    autoRefreshToken: false,
    detectSessionInUrl: false,
    debug: false,
    skipAutoInitialize: true,
    fetch: guardedFetch(options.fetch),
  });
}

export function configuredProvider<Request>(options: ServerSdkOptions<Request>, provider: string) {
  return Object.hasOwn(options.providers, provider) ? options.providers[provider] : undefined;
}

export function sameLeg(original: ServerSdkLeg, current: ServerSdkLeg): boolean {
  return (
    original.id === current.id &&
    original.runtime.intentId === current.runtime.intentId &&
    original.runtime.legId === current.runtime.legId &&
    original.runtime.attempt === current.runtime.attempt &&
    original.runtime.storageKey === current.runtime.storageKey &&
    original.runtime.issuedAt === current.runtime.issuedAt
  );
}

function guardedFetch(fetcher: typeof fetch | undefined): typeof fetch {
  const upstream = fetcher ?? globalThis.fetch;
  return async (input, init) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    if (url.pathname.endsWith('/token') && url.searchParams.get('grant_type') === 'refresh_token')
      return new Response('{"error":"refresh_disabled"}', {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    return upstream(input, init);
  };
}

export async function nonce(crypto: Crypto): Promise<{ raw: string; hash: Uint8Array }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return {
    raw: [...bytes].map((value) => value.toString(16).padStart(2, '0')).join(''),
    hash: new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
  };
}

export function live(leg: ServerSdkLeg): boolean {
  return leg.active && leg.state === 'issued' && leg.intentState === `awaiting_${leg.side}`;
}

export function exchangeLive(leg: ServerSdkLeg): boolean {
  return (
    leg.active &&
    leg.intentState === `awaiting_${leg.side}` &&
    (leg.state === 'issued' || leg.state === 'exchanging')
  );
}

export async function usable(
  auth: ServerSdkClient,
  leg: ServerSdkLeg,
  session: Session,
): Promise<boolean> {
  if (!session.access_token || !session.user?.id || (leg.side === 'source' && !leg.expectedAuthUid))
    return false;
  const verified = await auth.getUser(session.access_token);
  return (
    !verified.error &&
    verified.data.user?.id === session.user.id &&
    (!leg.expectedAuthUid || verified.data.user.id === leg.expectedAuthUid)
  );
}

export async function stored(storage: EncryptedPkceStorage, key: string): Promise<Session | null> {
  const value = await storage.getItem(key);
  if (!value) return null;
  const parsed: unknown = JSON.parse(value);
  if (!sessionShape(parsed)) throw new Error('invalid_session');
  return parsed as Session;
}

function sessionShape(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const session = value as Record<string, unknown>;
  const user = session.user;
  return (
    typeof session.access_token === 'string' &&
    typeof session.refresh_token === 'string' &&
    typeof session.expires_in === 'number' &&
    Number.isFinite(session.expires_in) &&
    typeof session.expires_at === 'number' &&
    Number.isFinite(session.expires_at) &&
    session.token_type === 'bearer' &&
    typeof user === 'object' &&
    user !== null &&
    typeof (user as Record<string, unknown>).id === 'string'
  );
}
