import { type RuntimeContext, RuntimeStorageError } from './types.ts';

export type Slots = { [key: string]: string };
export type Envelope = { slots: Slots; ingestNonce?: string };
const localFailures = new WeakMap<RuntimeStorageError, RuntimeStorageError['code']>();

export function failure(code: RuntimeStorageError['code']): RuntimeStorageError {
  const error = new RuntimeStorageError(code);
  localFailures.set(error, code);
  return error;
}

export function localFailure(error: unknown): RuntimeStorageError | undefined {
  const code = error instanceof RuntimeStorageError ? localFailures.get(error) : undefined;
  return code === undefined ? undefined : failure(code);
}

export function isSlots(value: unknown): value is Slots {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((entry) => typeof entry === 'string')
  );
}

export function isEnvelope(value: unknown): value is Envelope {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const envelope = value as { slots?: unknown; ingestNonce?: unknown };
  if ('ingestNonce' in envelope && !Object.hasOwn(envelope, 'ingestNonce')) return false;
  const keys = Object.keys(envelope);
  const nonce = envelope.ingestNonce;
  return (
    Object.hasOwn(envelope, 'slots') &&
    keys.every((key) => key === 'slots' || key === 'ingestNonce') &&
    isSlots(envelope.slots) &&
    (nonce === undefined || (typeof nonce === 'string' && /^[0-9a-f]{64}$/.test(nonce)))
  );
}

export function allowedKey(context: RuntimeContext, key: string): boolean {
  const base = context.storageKey;
  return (
    key === base ||
    key === `${base}-code-verifier` ||
    key === `${base}-flows-code-verifier` ||
    key === `${base}-user` ||
    new RegExp(`^${escapePattern(base)}-flow-[A-Za-z0-9_-]{8,64}-code-verifier$`).test(key)
  );
}

export function validateKey(context: RuntimeContext, key: string): void {
  if (!allowedKey(context, key)) throw failure('invalid_storage_key');
}

function escapePattern(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function sanitize(key: string, base: string, value: string): string {
  if (key !== base) return value;
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
      throw failure('malformed_value');
    const session = parsed as { provider_token?: unknown; provider_refresh_token?: unknown };
    delete session.provider_token;
    delete session.provider_refresh_token;
    return JSON.stringify(session);
  } catch {
    throw failure('malformed_value');
  }
}
