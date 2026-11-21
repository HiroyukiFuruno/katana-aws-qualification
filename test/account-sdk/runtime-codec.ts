import type {
  RuntimeKeyring,
  RuntimeRecord,
} from '../../supabase/functions/account-linking/runtime/types.ts';

export const material = new TextEncoder().encode('kaq-account-sdk-integration-key!');

export function record(value: unknown): RuntimeRecord {
  if (!value || typeof value !== 'object') throw new Error('invalid runtime record');
  const item = value as Record<string, unknown>;
  if (![item.revision, item.expiresAt].every(Number.isSafeInteger))
    throw new Error('invalid runtime revision');
  if (
    typeof item.keyVersion !== 'string' ||
    typeof item.nonce !== 'string' ||
    typeof item.ciphertext !== 'string'
  )
    throw new Error('invalid runtime material');
  const bytes = (hex: string) => {
    if (!/^(?:[0-9a-f]{2})+$/i.test(hex)) throw new Error('invalid runtime encoding');
    return Uint8Array.from(hex.match(/.{2}/g)?.map((pair) => Number.parseInt(pair, 16)) ?? []);
  };
  return {
    revision: item.revision as number,
    keyVersion: item.keyVersion,
    nonce: bytes(item.nonce),
    ciphertext: bytes(item.ciphertext),
    expiresAt: item.expiresAt as number,
  };
}

export function runtimeJson(value: RuntimeRecord) {
  return JSON.stringify({
    revision: value.revision,
    keyVersion: value.keyVersion,
    nonce: Buffer.from(value.nonce).toString('hex'),
    ciphertext: Buffer.from(value.ciphertext).toString('hex'),
    expiresAt: value.expiresAt,
  });
}

export function keyring(): RuntimeKeyring {
  return {
    active: async () => ({ version: 'sdk-test-v1', bytes: material }),
    resolve: async (version) => (version === 'sdk-test-v1' ? material : null),
  };
}
