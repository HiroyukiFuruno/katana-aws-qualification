import type { ServerSdkLeg, ServerSdkOptions, ServerSdkResult } from './sdk-worker.types.ts';
import { client, exchangeLive, live, result, sameLeg, stored } from './sdk-worker-internal.ts';
import { verifySession } from './sdk-worker-verification.ts';

export async function recoverExchange<Request>(
  options: ServerSdkOptions<Request>,
  request: Request,
  original: ServerSdkLeg,
  claimed: boolean,
  fail: (current: ServerSdkLeg, unknown: boolean) => Promise<ServerSdkResult>,
): Promise<ServerSdkResult> {
  let current = original;
  for (let inspection = 0; inspection < 2; inspection += 1) {
    try {
      current = await options.control.loadExchange(request);
      if (!sameLeg(original, current)) return result(original, 'runtime_failed');
      if (!exchangeLive(current)) return result(current);
      // 2回目は応答喪失後の確定状態だけを読み、交換やpromotionを再実行しない。
      if (inspection !== 0 || current.state !== 'exchanging') continue;
      const storage = options.storage(current);
      await storage.getIngestNonce(current.nonceHash);
      const receipt = await stored(storage, current.runtime.storageKey);
      if (receipt) {
        const verified = await verifySession(client(options, current), current, receipt);
        if (verified === 'unavailable') return result(current, 'runtime_failed');
        return verified === 'verified'
          ? result(await options.control.promote(current))
          : fail(current, false);
      }
    } catch {}
  }
  return claimed ? fail(current, true) : result(current, 'runtime_failed');
}

export async function recordAuthorizationFailure<Request>(
  options: ServerSdkOptions<Request>,
  request: Request,
  original: ServerSdkLeg,
  claimId: string,
): Promise<ServerSdkResult> {
  let current = original;
  try {
    current = await options.control.reloadAuthorization(request);
    if (!sameLeg(original, current))
      return { ...result(original, 'authorization_failed'), restartRequired: true };
    if (!live(current)) return result(current);
    if (current.authorizationPrepared) return { ...result(current), restartRequired: true };
    return result(await options.control.failAuthorization(current, claimId), 'authorization_failed');
  } catch {
    try {
      const latest = await options.control.reloadAuthorization(request);
      if (sameLeg(original, latest)) {
        current = latest;
        if (!live(latest))
          return result(latest, latest.state === 'failed' ? 'authorization_failed' : undefined);
        if (latest.authorizationPrepared) return { ...result(latest), restartRequired: true };
      }
    } catch {}
    return { ...result(current, 'authorization_failed'), restartRequired: true };
  }
}
