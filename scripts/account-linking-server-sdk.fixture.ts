import type { Session } from '@supabase/auth-js';
import { ServerSdkWorker } from '../supabase/functions/account-linking/server/sdk-worker.ts';
import type {
  ServerSdkControl,
  ServerSdkLeg,
} from '../supabase/functions/account-linking/server/sdk-worker.types.ts';
import { context, MemoryRepository, storage } from './account-linking-runtime-fixture.ts';

const session = {
  access_token: 'access-secret',
  refresh_token: 'refresh-secret',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: 2_000_000_000,
  provider_token: 'provider-secret',
  provider_refresh_token: 'provider-refresh-secret',
  user: {
    id: 'source-user',
    aud: 'authenticated',
    app_metadata: {},
    user_metadata: {},
    created_at: '2026-01-01T00:00:00Z',
  },
} as Session;

export function fixture(overrides: Partial<ServerSdkLeg> = {}) {
  const repository = new MemoryRepository();
  let leg: ServerSdkLeg = {
    id: '22222222-2222-4222-8222-222222222222',
    revision: 0,
    state: 'issued',
    intentState: 'awaiting_source',
    expiresAt: context().expiresAt,
    provider: 'github',
    runtime: context(),
    nonceHash: new Uint8Array(32),
    side: 'source',
    active: true,
    authorizationPrepared: false,
    expectedAuthUid: 'source-user',
    ...overrides,
  };
  const calls = { claim: 0, complete: 0, promote: 0, fail: 0 };
  const control: ServerSdkControl<void> = {
    openAuthorization: async (_, hash) => (leg = { ...leg, nonceHash: new Uint8Array(hash) }),
    reloadAuthorization: async () => leg,
    claimAuthorization: async () => ({ claimed: ++calls.claim === 1, claimId: 'claim-1' }),
    completeAuthorization: async () => {
      calls.complete++;
      return { ...leg, authorizationPrepared: true };
    },
    failAuthorization: async () => ({ legId: leg.id, state: 'failed', expiresAt: leg.expiresAt }),
    loadExchange: async () => leg,
    claimExchange: async () => ({ claimed: false, leg }),
    promote: async () => {
      calls.promote++;
      return { legId: leg.id, state: 'exchanged', expiresAt: leg.expiresAt };
    },
    failExchange: async () => {
      calls.fail++;
      return { legId: leg.id, state: 'failed', expiresAt: leg.expiresAt };
    },
  };
  const worker = new ServerSdkWorker({
    control,
    storage: () => storage(repository, { context: leg.runtime }),
    url: 'https://project.example',
    key: 'public-key',
    providers: { github: { callback: 'https://app.example/callback', scopes: 'read:user' } },
    fetch: async (_input) =>
      new Response(
        JSON.stringify({
          id: 'source-user',
          aud: 'authenticated',
          app_metadata: {},
          user_metadata: {},
          created_at: '2026-01-01T00:00:00Z',
        }),
        { headers: { 'content-type': 'application/json' } },
      ),
  });
  return {
    worker,
    repository,
    control,
    calls,
    get leg() {
      return leg;
    },
  };
}

export async function initialize(subject: ReturnType<typeof fixture>, value: string) {
  const pairs = value.match(/.{2}/g);
  if (!pairs) throw new Error('test_nonce_invalid');
  subject.leg.nonceHash = new Uint8Array(
    await crypto.subtle.digest(
      'SHA-256',
      Uint8Array.from(pairs.map((part) => Number.parseInt(part, 16))),
    ),
  );
  const current = storage(subject.repository, { context: subject.leg.runtime });
  await current.initialize(value, subject.leg.nonceHash);
  return { current, session };
}
