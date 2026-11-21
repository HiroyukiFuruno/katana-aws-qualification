import { RuntimeStorageError, type RuntimeContext } from './types.ts';

export type Slots = { [key: string]: string };

export function failure(code: RuntimeStorageError['code']): RuntimeStorageError {
  return new RuntimeStorageError(code);
}

export function isSlots(value: unknown): value is Slots {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.values(value).every((entry) => typeof entry === 'string')
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
  } catch (error) {
    if (error instanceof RuntimeStorageError) throw error;
    throw failure('malformed_value');
  }
}
