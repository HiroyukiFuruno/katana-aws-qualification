import type { Locale } from '../locales';

export type AuthProvider = { id: string; backend: string; name: string; scopes: string };
export type AccountIdentity = { id: string; provider: string };
export type Account = {
  id: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  identities: AccountIdentity[];
};
export type AuthState =
  | { status: 'loading' | 'unavailable' | 'error'; account: null }
  | { status: 'ready'; account: Account | null };

export interface AccountAuth {
  readonly providers: readonly AuthProvider[];
  getAccount(): Promise<Account | null>;
  subscribe(listener: (account: Account | null) => void): () => void;
  signIn(providerId: string, locale: Locale): Promise<string>;
  completeCallback(search: string): Promise<Account>;
  refresh(): Promise<Account | null>;
  signOut(): Promise<void>;
  linkIdentity(providerId: string, locale: Locale): Promise<string>;
  unlinkIdentity(identityId: string): Promise<void>;
}
