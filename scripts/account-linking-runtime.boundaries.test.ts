import { expect, test } from 'bun:test';
import { fixedContext } from '../supabase/functions/account-linking/runtime/context.ts';
import { decryptSlots, encryptSlots } from '../supabase/functions/account-linking/runtime/crypto.ts';
import { sanitize } from '../supabase/functions/account-linking/runtime/slots.ts';
import { RuntimeStorageError } from '../supabase/functions/account-linking/runtime/types.ts';
import { context, storageKey } from './account-linking-runtime-fixture.ts';

function untrustedGetter(): never {
  const error = new RuntimeStorageError('invalid_context');
  error.message = 'getter-secret';
  throw error;
}

test('direct crypto and validation helpers redact errors thrown while inspecting inputs', async () => {
  const bound = context();
  const material = new Uint8Array(32);
  const record = await encryptSlots(globalThis.crypto, bound, 0, 'v1', material, {});
  Object.defineProperty(record, 'revision', { get: untrustedGetter });
  const suppliedContext = context();
  Object.defineProperty(suppliedContext, 'intentId', { get: untrustedGetter });
  const suppliedText = { toString: untrustedGetter } as unknown as string;
  const cases: [string, () => unknown][] = [
    ['decrypt_failed', () => decryptSlots(globalThis.crypto, bound, record, material)],
    ['invalid_context', () => fixedContext(suppliedContext)],
    ['malformed_value', () => sanitize(storageKey, storageKey, suppliedText)],
    ['invalid_key', () => encryptSlots(globalThis.crypto, bound, 0, suppliedText, material, {})],
  ];
  for (const [code, operation] of cases) {
    const error: unknown = await Promise.resolve()
      .then(operation)
      .catch((reason) => reason);
    expect(error).toMatchObject({ code, message: `account-linking runtime storage: ${code}` });
    expect(error instanceof Error && error.cause).toBeUndefined();
  }
});
