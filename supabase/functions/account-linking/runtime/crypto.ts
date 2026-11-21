import { type Envelope, failure, isEnvelope, type Slots } from './slots.ts';
import type { RuntimeContext, RuntimeRecord } from './types.ts';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytes(value: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy.buffer;
}

async function key(crypto: Crypto, material: Uint8Array, usages: KeyUsage[]): Promise<CryptoKey> {
  if (material.length !== 32) throw failure('invalid_key');
  return crypto.subtle.importKey('raw', bytes(material), { name: 'AES-GCM' }, false, usages);
}

export async function decryptEnvelope(
  crypto: Crypto,
  context: RuntimeContext,
  record: RuntimeRecord,
  material: Uint8Array,
): Promise<Envelope> {
  try {
    if (!validRecord(record)) throw failure('invalid_context');
    const plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: bytes(record.nonce),
        additionalData: associatedData(context, record.keyVersion),
      },
      await key(crypto, material, ['decrypt']),
      bytes(record.ciphertext),
    );
    const parsed: unknown = JSON.parse(decoder.decode(plaintext));
    if (!isEnvelope(parsed)) throw failure('decrypt_failed');
    return parsed;
  } catch {
    throw failure('decrypt_failed');
  }
}

function validRecord(record: RuntimeRecord): boolean {
  return (
    Number.isSafeInteger(record.revision) &&
    record.revision >= 0 &&
    /^[A-Za-z0-9._-]{1,64}$/.test(record.keyVersion) &&
    record.nonce instanceof Uint8Array &&
    record.nonce.length === 12 &&
    record.ciphertext instanceof Uint8Array &&
    record.ciphertext.length >= 16 &&
    Number.isSafeInteger(record.expiresAt)
  );
}

export async function encryptEnvelope(
  crypto: Crypto,
  context: RuntimeContext,
  revision: number,
  keyVersion: string,
  material: Uint8Array,
  envelope: Envelope,
): Promise<RuntimeRecord> {
  try {
    if (
      !Number.isSafeInteger(revision) ||
      revision < 0 ||
      !/^[A-Za-z0-9._-]{1,64}$/.test(keyVersion) ||
      !isEnvelope(envelope)
    )
      throw failure('invalid_key');
    const nonce = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = bytes(encoder.encode(JSON.stringify(envelope)));
    const ciphertext = new Uint8Array(
      await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: bytes(nonce), additionalData: associatedData(context, keyVersion) },
        await key(crypto, material, ['encrypt']),
        plaintext,
      ),
    );
    return { revision, keyVersion, nonce, ciphertext, expiresAt: context.expiresAt };
  } catch {
    throw failure('invalid_key');
  }
}

export async function decryptSlots(
  crypto: Crypto,
  context: RuntimeContext,
  record: RuntimeRecord,
  material: Uint8Array,
): Promise<Slots> {
  return (await decryptEnvelope(crypto, context, record, material)).slots;
}

export async function encryptSlots(
  crypto: Crypto,
  context: RuntimeContext,
  revision: number,
  keyVersion: string,
  material: Uint8Array,
  slots: Slots,
): Promise<RuntimeRecord> {
  return encryptEnvelope(crypto, context, revision, keyVersion, material, { slots });
}

export async function promoteEnvelope(
  crypto: Crypto,
  from: RuntimeContext,
  to: RuntimeContext,
  record: RuntimeRecord,
  oldMaterial: Uint8Array,
  revision: number,
  keyVersion: string,
  newMaterial: Uint8Array,
): Promise<RuntimeRecord> {
  const [source, target] = promotionContexts(from, to, record, revision);
  return encryptEnvelope(
    crypto,
    target,
    revision,
    keyVersion,
    newMaterial,
    await decryptEnvelope(crypto, source, record, oldMaterial),
  );
}

import { promotionContexts } from './context.ts';
import { associatedData } from './crypto-aad.ts';
