import { expect, test } from 'bun:test';
import {
  encryptEnvelope,
  promoteEnvelope,
} from '../supabase/functions/account-linking/runtime/crypto.ts';
import type { RuntimeContext } from '../supabase/functions/account-linking/runtime/types.ts';
import { context } from './account-linking-runtime-fixture.ts';

const oldKey = new Uint8Array(32).fill(7);
const newKey = new Uint8Array(32).fill(9);

test('promotion refuses rebinding a leg envelope outside its canonical proof context', async () => {
  const from = context();
  const proof = context({ purpose: 'proof', expiresAt: from.issuedAt + 600_000 });
  const record = await encryptEnvelope(globalThis.crypto, from, 0, 'v1', oldKey, { slots: {} });
  const invalid: RuntimeContext[] = [
    { ...proof, intentId: '33333333-3333-4333-8333-333333333333' },
    { ...proof, legId: '44444444-4444-4444-8444-444444444444' },
    { ...proof, attempt: 2 },
    { ...proof, storageKey: `${proof.storageKey}-other` },
    { ...proof, issuedAt: proof.issuedAt + 1 },
    { ...from, purpose: 'leg' },
    { ...proof, expiresAt: proof.issuedAt + 600_001 },
    { ...proof, expiresAt: from.expiresAt - 1 },
    {
      ...proof,
      intentId: '33333333-3333-4333-8333-333333333333',
      storageKey: `kaq-proof:33333333-3333-4333-8333-333333333333:${proof.legId}:1`,
    },
    {
      ...proof,
      legId: '44444444-4444-4444-8444-444444444444',
      storageKey: `kaq-proof:${proof.intentId}:44444444-4444-4444-8444-444444444444:1`,
    },
    { ...proof, attempt: 2, storageKey: `kaq-proof:${proof.intentId}:${proof.legId}:2` },
  ];
  for (const target of invalid)
    await expect(
      promoteEnvelope(globalThis.crypto, from, target, record, oldKey, 1, 'v2', newKey),
    ).rejects.toThrow('invalid_context');
});

test('promotion binds the old expiry and the exact next revision', async () => {
  const from = context();
  const proof = context({ purpose: 'proof', expiresAt: from.issuedAt + 600_000 });
  const record = await encryptEnvelope(globalThis.crypto, from, 0, 'v1', oldKey, { slots: {} });
  await expect(
    promoteEnvelope(
      globalThis.crypto,
      from,
      proof,
      { ...record, expiresAt: from.expiresAt - 1 },
      oldKey,
      1,
      'v2',
      newKey,
    ),
  ).rejects.toThrow('invalid_context');
  for (const revision of [0, 2, Number.MAX_SAFE_INTEGER + 1])
    await expect(
      promoteEnvelope(globalThis.crypto, from, proof, record, oldKey, revision, 'v2', newKey),
    ).rejects.toThrow('invalid_context');
});
