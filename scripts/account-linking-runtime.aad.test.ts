import { expect, test } from 'bun:test';
import { decryptSlots, encryptSlots } from '../supabase/functions/account-linking/runtime/crypto.ts';
import { context } from './account-linking-runtime-fixture.ts';

test('AAD independently binds every proof context field and expiry boundary', async () => {
  const current = context();
  const material = new Uint8Array(32).fill(4);
  const record = await encryptSlots(globalThis.crypto, current, 0, 'v1', material, {
    [current.storageKey]: '{"access_token":"a"}',
  });
  await expect(decryptSlots(globalThis.crypto, current, record, material)).resolves.toEqual({
    [current.storageKey]: '{"access_token":"a"}',
  });
  const changed = [
    { ...current, purpose: 'proof' as const },
    { ...current, intentId: '33333333-3333-4333-8333-333333333333' },
    { ...current, legId: '44444444-4444-4444-8444-444444444444' },
    { ...current, attempt: 2 },
    { ...current, storageKey: `${current.storageKey}:changed` },
    { ...current, issuedAt: current.issuedAt + 1 },
    { ...current, expiresAt: current.expiresAt + 1 },
  ];
  for (const other of changed)
    await expect(decryptSlots(globalThis.crypto, other, record, material)).rejects.toThrow();
});
