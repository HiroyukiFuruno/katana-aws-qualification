import { expect, test } from 'bun:test';
import { encryptEnvelope } from '../supabase/functions/account-linking/runtime/crypto.ts';
import { type Envelope, isEnvelope } from '../supabase/functions/account-linking/runtime/slots.ts';
import { context } from './account-linking-runtime-fixture.ts';

function inheritedSlots(): object {
  return Object.create({ slots: {} });
}

test('envelope requires slots to be an own property', () => {
  expect(isEnvelope(inheritedSlots())).toBeFalse();
});

test('envelope refuses inherited nonce fields that JSON would silently omit', () => {
  const inherited: unknown = Object.assign(Object.create({ ingestNonce: 'ab'.repeat(32) }), {
    slots: {},
  });
  expect(isEnvelope(inherited)).toBeFalse();
});

test('encryption refuses an envelope whose required slots are inherited', async () => {
  await expect(
    encryptEnvelope(
      globalThis.crypto,
      context(),
      0,
      'v1',
      new Uint8Array(32).fill(7),
      inheritedSlots() as Envelope,
    ),
  ).rejects.toThrow('invalid_key');
});
