import type { Session } from '@supabase/auth-js';
import type { EncryptedPkceStorage } from '../supabase/functions/account-linking/runtime/pkce-storage.ts';
import type {
  ServerSdkControl,
  ServerSdkLeg,
} from '../supabase/functions/account-linking/server/sdk-worker.types.ts';
import { context, MemoryRepository, storage } from './account-linking-runtime-fixture.ts';

export const uid = 'source-user';
export const session = (userId = uid): Session => ({
  access_token: 'access-secret',
  refresh_token: 'refresh-secret',
  expires_in: 3600,
  expires_at: 1_800_003_600,
  token_type: 'bearer',
  user: { id: userId } as Session['user'],
});

export function leg(overrides: Partial<ServerSdkLeg> = {}): ServerSdkLeg {
  const runtime = context({ legId: overrides.id ?? '22222222-2222-4222-8222-222222222222' });
  return {
    id: runtime.legId,
    revision: 1,
    state: 'issued',
    intentState: 'awaiting_source',
    expiresAt: runtime.expiresAt,
    provider: 'github',
    runtime,
    nonceHash: new Uint8Array(32),
    side: 'source',
    active: true,
    authorizationPrepared: true,
    expectedAuthUid: uid,
    ...overrides,
  };
}

export type Calls = {
  initialize: number;
  authorize: number;
  exchange: number;
  refresh: number;
  getUser: number;
  claimed: number;
  promote: number;
};

export function nativeFetch(
  calls: Calls,
  options: { token?: Session; userId?: string; failToken?: unknown } = {},
): typeof fetch {
  return async (input, init) => {
    const url = String(input);
    if (url.includes('/authorize?')) {
      calls.authorize += 1;
      return new Response(null, {
        status: 302,
        headers: { location: 'https://provider.example/authorize' },
      });
    }
    if (url.includes('/token?')) {
      if (url.includes('grant_type=refresh_token')) calls.refresh += 1;
      else calls.exchange += 1;
      if (options.failToken) throw options.failToken;
      return Response.json(options.token ?? session());
    }
    if (url.endsWith('/user')) {
      calls.getUser += 1;
      return Response.json({ id: options.userId ?? uid });
    }
    throw new Error(`unexpected endpoint ${init?.method ?? 'GET'} ${url}`);
  };
}

export function harness(initial = leg(), fetch?: typeof globalThis.fetch) {
  const calls: Calls = {
    initialize: 0,
    authorize: 0,
    exchange: 0,
    refresh: 0,
    getUser: 0,
    claimed: 0,
    promote: 0,
  };
  const repositories = new Map<string, MemoryRepository>();
  let current = initial;
  const control: ServerSdkControl<string> = {
    openAuthorization: async (_request, nonceHash) => (current = { ...current, nonceHash }),
    reloadAuthorization: async () => current,
    claimAuthorization: async () => {
      calls.claimed += 1;
      return { claimed: true, claimId: 'claim-1' };
    },
    completeAuthorization: async (value) => (current = { ...value, authorizationPrepared: true }),
    failAuthorization: async (value) => ({
      legId: value.id,
      state: 'failed',
      expiresAt: value.expiresAt,
    }),
    loadExchange: async () => current,
    claimExchange: async (value) => ({ claimed: true, leg: value }),
    promote: async (value) => {
      calls.promote += 1;
      return { legId: value.id, state: 'exchanged', expiresAt: value.expiresAt };
    },
    failExchange: async (value, unknown) => ({
      legId: value.id,
      state: unknown ? 'exchange_unknown' : 'failed',
      expiresAt: value.expiresAt,
    }),
  };
  const storageFor = (value: ServerSdkLeg): EncryptedPkceStorage => {
    let repository = repositories.get(value.id);
    if (!repository) {
      repository = new MemoryRepository();
      repositories.set(value.id, repository);
    }
    return storage(repository, { context: value.runtime });
  };
  return {
    calls,
    control,
    storageFor,
    get current() {
      return current;
    },
    set current(value: ServerSdkLeg) {
      current = value;
    },
    fetch: fetch ?? nativeFetch(calls),
  };
}

export async function prime(h: ReturnType<typeof harness>): Promise<void> {
  const bytes = new Uint8Array(32);
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  h.current = { ...h.current, nonceHash: hash };
  await h.storageFor(h.current).initialize('00'.repeat(32), hash);
}
