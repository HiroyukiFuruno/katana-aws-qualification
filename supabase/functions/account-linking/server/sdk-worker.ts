import type { Provider } from '@supabase/auth-js';
import type { ServerSdkLeg, ServerSdkOptions, ServerSdkResult } from './sdk-worker.types.ts';
import {
  client,
  configuredProvider,
  exchangeLive,
  live,
  nonce,
  result,
  stored,
  usable,
} from './sdk-worker-internal.ts';
import { recordAuthorizationFailure, recoverExchange } from './sdk-worker-recovery.ts';

export type { ServerSdkControl, ServerSdkOptions, ServerSdkResult } from './sdk-worker.types.ts';

function indeterminate(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const value = error as { name?: unknown; status?: unknown };
  return (
    value.name === 'AuthRetryableFetchError' || (typeof value.status === 'number' && value.status >= 500)
  );
}

export class ServerSdkWorker<Request> {
  constructor(private readonly options: ServerSdkOptions<Request>) {}

  private async exchangeFailure(leg: ServerSdkLeg, unknown: boolean): Promise<ServerSdkResult> {
    try {
      return result(
        await this.options.control.failExchange(leg, unknown),
        unknown ? 'exchange_unknown' : 'exchange_failed',
      );
    } catch {
      return result(leg, unknown ? 'exchange_unknown' : 'exchange_failed');
    }
  }

  async begin(request: Request): Promise<ServerSdkResult> {
    let leg: ServerSdkLeg | undefined;
    let claimId: string | undefined;
    try {
      const generated = await nonce(this.options.crypto ?? globalThis.crypto);
      leg = await this.options.control.openAuthorization(request, generated.hash);
      if (!live(leg)) return result(leg);
      const allowed = configuredProvider(this.options, leg.provider);
      if (!allowed) return result(leg, 'runtime_failed');
      const storage = this.options.storage(leg);
      if (leg.nonceHash.every((value, index) => value === generated.hash[index]))
        await storage.initialize(generated.raw, leg.nonceHash);
      else await storage.getIngestNonce(leg.nonceHash);
      const claimed = await this.options.control.claimAuthorization(
        await this.options.control.reloadAuthorization(request),
      );
      claimId = claimed.claimId;
      if (!claimed.claimed || !claimId) return { ...result(leg), restartRequired: true };
      const auth = client(this.options, leg);
      if ((await auth.initialize()).error) throw new Error('initialize_failed');
      const response = await auth.signInWithOAuth({
        provider: leg.provider as Provider,
        options: { redirectTo: allowed.callback, scopes: allowed.scopes, skipBrowserRedirect: true },
      });
      if (response.error || !response.data.url) throw new Error('authorization_failed');
      const completed = await this.options.control.completeAuthorization(
        await this.options.control.reloadAuthorization(request),
        claimId,
      );
      return live(completed) && completed.authorizationPrepared
        ? { ...result(completed), authorizationUrl: response.data.url }
        : result(completed);
    } catch {
      if (!leg) return { legId: '', state: 'failed', expiresAt: 0, failure: 'runtime_failed' };
      return claimId
        ? recordAuthorizationFailure(this.options, request, leg, claimId)
        : result(leg, 'runtime_failed');
    }
  }

  async exchange(request: Request, code: string): Promise<ServerSdkResult> {
    let leg: ServerSdkLeg | undefined;
    let claimed = false;
    try {
      leg = await this.options.control.loadExchange(request);
      if (!exchangeLive(leg)) return result(leg);
      const storage = this.options.storage(leg);
      await storage.getIngestNonce(leg.nonceHash);
      const auth = client(this.options, leg);
      const restored = await stored(storage, leg.runtime.storageKey);
      if (restored)
        return leg.state === 'exchanging' && (await usable(auth, leg, restored))
          ? result(await this.options.control.promote(leg))
          : this.exchangeFailure(leg, false);
      const exchange = await this.options.control.claimExchange(leg);
      leg = exchange.leg;
      claimed = exchange.claimed;
      if (!claimed) return { ...result(leg), restartRequired: true };
      if ((await auth.initialize()).error) throw new Error('initialize_failed');
      const response = await auth.exchangeCodeForSession(code);
      const receipt = await stored(storage, leg.runtime.storageKey);
      if (receipt && (await usable(auth, leg, receipt)))
        return result(await this.options.control.promote(leg));
      if (response.error && indeterminate(response.error)) throw new Error('exchange_unknown');
      if (response.error || !response.data.session || !(await usable(auth, leg, response.data.session)))
        return this.exchangeFailure(leg, false);
      throw new Error('receipt_missing');
    } catch {
      if (!leg) return { legId: '', state: 'failed', expiresAt: 0, failure: 'runtime_failed' };
      return recoverExchange(this.options, request, leg, claimed, (current, unknown) =>
        this.exchangeFailure(current, unknown),
      );
    }
  }
}
