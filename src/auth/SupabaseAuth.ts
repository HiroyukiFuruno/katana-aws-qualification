import type { GoTrueClient, Provider } from '@supabase/auth-js';
import type { Locale } from '../locales';
import { accountFrom } from './account';
import { callbackCode, callbackPath } from './navigation';
import type { Account, AccountAuth, AuthProvider } from './types';

export class SupabaseAuth implements AccountAuth {
  constructor(
    private readonly client: GoTrueClient,
    readonly providers: readonly AuthProvider[],
    private readonly origin: string,
  ) {}

  async getAccount() {
    const { data: session, error: sessionError } = await this.client.getSession();
    if (sessionError) throw sessionError;
    if (!session.session) return null;
    const { data, error } = await this.client.getUser();
    if (error) throw error;
    return accountFrom(data.user);
  }

  subscribe(listener: (account: Account | null) => void) {
    const { data } = this.client.onAuthStateChange((_event, session) => {
      listener(session ? accountFrom(session.user) : null);
    });
    return () => data.subscription.unsubscribe();
  }

  private options(providerId: string, locale: Locale) {
    const provider = this.providers.find((entry) => entry.id === providerId);
    if (!provider) throw new Error('Provider is not available');
    return {
      provider: provider.backend as Provider,
      options: {
        scopes: provider.scopes,
        redirectTo: this.origin + callbackPath(locale),
        skipBrowserRedirect: true,
      },
    };
  }

  async signIn(providerId: string, locale: Locale) {
    const { data, error } = await this.client.signInWithOAuth(this.options(providerId, locale));
    if (error) throw error;
    if (!data.url) throw new Error('Missing authorization URL');
    return data.url;
  }

  async completeCallback(search: string) {
    const { data, error } = await this.client.exchangeCodeForSession(callbackCode(search));
    if (error) throw error;
    if (!data.user) throw new Error('Missing authenticated user');
    return accountFrom(data.user);
  }

  async refresh() {
    const { data, error } = await this.client.refreshSession();
    if (error) throw error;
    return data.user ? accountFrom(data.user) : null;
  }

  async signOut() {
    const { error } = await this.client.signOut();
    if (error) throw error;
  }

  async linkIdentity(providerId: string, locale: Locale) {
    if (!(await this.getAccount())) throw new Error('Authentication required');
    const { data, error } = await this.client.linkIdentity(this.options(providerId, locale));
    if (error) throw error;
    if (!data.url) throw new Error('Missing authorization URL');
    return data.url;
  }

  async unlinkIdentity(identityId: string) {
    const account = await this.getAccount();
    if (!account || account.identities.length < 2) throw new Error('Keep one sign-in method');
    const identity = account.identities.find((entry) => entry.id === identityId);
    if (!identity) throw new Error('Identity does not belong to this account');
    const { data, error: userError } = await this.client.getUser();
    if (userError) throw userError;
    const original = data.user.identities?.find((entry) => entry.identity_id === identity.id);
    if (!original) throw new Error('Identity no longer exists');
    const { error } = await this.client.unlinkIdentity(original);
    if (error) throw error;
  }
}
