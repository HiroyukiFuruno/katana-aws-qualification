import type { AuthClient } from '@supabase/auth-js';
import type { EncryptedPkceStorage } from '../runtime/pkce-storage.ts';
import type { RuntimeContext } from '../runtime/types.ts';

export type ServerSdkLeg = {
  id: string;
  revision: number;
  state: string;
  intentState: string;
  expiresAt: number;
  provider: string;
  runtime: RuntimeContext;
  nonceHash: Uint8Array;
  side: 'source' | 'target';
  active: boolean;
  authorizationPrepared: boolean;
  expectedAuthUid?: string;
};

export type ServerSdkStatus = { legId: string; state: string; expiresAt: number };
export type ServerSdkResult = ServerSdkStatus & {
  authorizationUrl?: string;
  restartRequired?: boolean;
  failure?: 'authorization_failed' | 'exchange_failed' | 'exchange_unknown' | 'runtime_failed';
};

export type ServerSdkControl<Request> = {
  /** main actor/session/intent secretの検証をこの境界へ閉じ込め、公開入力に権限を持たせない。 */
  openAuthorization(request: Request, nonceHash: Uint8Array): Promise<ServerSdkLeg>;
  reloadAuthorization(request: Request): Promise<ServerSdkLeg>;
  claimAuthorization(leg: ServerSdkLeg): Promise<{ claimed: boolean; claimId?: string }>;
  completeAuthorization(leg: ServerSdkLeg, claimId: string): Promise<ServerSdkLeg>;
  failAuthorization(leg: ServerSdkLeg, claimId: string): Promise<ServerSdkStatus>;
  loadExchange(request: Request): Promise<ServerSdkLeg>;
  claimExchange(leg: ServerSdkLeg): Promise<{ claimed: boolean; leg: ServerSdkLeg }>;
  promote(leg: ServerSdkLeg): Promise<ServerSdkStatus>;
  failExchange(leg: ServerSdkLeg, unknown: boolean): Promise<ServerSdkStatus>;
};

export type ServerSdkOptions<Request> = {
  control: ServerSdkControl<Request>;
  storage(leg: ServerSdkLeg): EncryptedPkceStorage;
  url: string;
  key: string;
  providers: Readonly<Record<string, { callback: string; scopes: string }>>;
  fetch?: typeof fetch;
  crypto?: Crypto;
};

export type ServerSdkClient = Pick<
  InstanceType<typeof AuthClient>,
  'initialize' | 'signInWithOAuth' | 'exchangeCodeForSession' | 'getUser'
>;
