import type { RuntimeContext } from './types.ts';

export function associatedData(context: RuntimeContext, keyVersion: string): ArrayBuffer {
  return new TextEncoder().encode(
    JSON.stringify([
      'kaq-proof-runtime-v1',
      keyVersion,
      context.purpose,
      context.intentId,
      context.legId,
      context.attempt,
      context.storageKey,
      context.issuedAt,
      context.expiresAt,
    ]),
  ).buffer;
}
