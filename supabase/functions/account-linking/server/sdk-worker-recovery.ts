import type { ServerSdkLeg, ServerSdkOptions, ServerSdkResult } from './sdk-worker.types.ts';
import { client, exchangeLive, result, stored, usable } from './sdk-worker-internal.ts';

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
      if (
        current.id !== original.id ||
        current.runtime.intentId !== original.runtime.intentId ||
        current.runtime.attempt !== original.runtime.attempt ||
        current.runtime.storageKey !== original.runtime.storageKey
      )
        return result(original, 'runtime_failed');
      if (!exchangeLive(current)) return result(current);
      // 2回目は応答喪失後の確定状態だけを読み、交換やpromotionを再実行しない。
      if (inspection !== 0 || current.state !== 'exchanging') continue;
      const storage = options.storage(current);
      await storage.getIngestNonce(current.nonceHash);
      const receipt = await stored(storage, current.runtime.storageKey);
      if (receipt && (await usable(client(options, current), current, receipt)))
        return result(await options.control.promote(current));
    } catch {}
  }
  return claimed ? fail(current, true) : result(current, 'runtime_failed');
}
