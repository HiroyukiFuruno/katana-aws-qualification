import { RuntimeStorageError, type RuntimeContext, type RuntimeRecord } from './types.ts';
import { failure, isSlots, type Slots } from './slots.ts';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function aad(context: RuntimeContext, keyVersion: string): ArrayBuffer {
  return bytes(
    encoder.encode(
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
    ),
  );
}

function bytes(value: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy.buffer;
}

async function key(crypto: Crypto, material: Uint8Array, usages: KeyUsage[]): Promise<CryptoKey> {
  if (material.length !== 32) throw failure('invalid_key');
  return crypto.subtle.importKey('raw', bytes(material), { name: 'AES-GCM' }, false, usages);
}

export async function decryptSlots(
  crypto: Crypto,
  context: RuntimeContext,
  record: RuntimeRecord,
  material: Uint8Array,
): Promise<Slots> {
  if (!validRecord(record)) throw failure('invalid_context');
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: bytes(record.nonce), additionalData: aad(context, record.keyVersion) },
      await key(crypto, material, ['decrypt']),
      bytes(record.ciphertext),
    );
    const parsed: unknown = JSON.parse(decoder.decode(plaintext));
    if (typeof parsed !== 'object' || parsed === null || !('slots' in parsed) || !isSlots(parsed.slots))
      throw failure('decrypt_failed');
    return parsed.slots;
  } catch (error) {
    if (error instanceof RuntimeStorageError) throw error;
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

export async function encryptSlots(
  crypto: Crypto,
  context: RuntimeContext,
  revision: number,
  keyVersion: string,
  material: Uint8Array,
  slots: Slots,
): Promise<RuntimeRecord> {
  if (!Number.isSafeInteger(revision) || revision < 0 || !/^[A-Za-z0-9._-]{1,64}$/.test(keyVersion))
    throw failure('invalid_key');
  try {
    const nonce = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = bytes(encoder.encode(JSON.stringify({ slots })));
    const ciphertext = new Uint8Array(
      await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: bytes(nonce), additionalData: aad(context, keyVersion) },
        await key(crypto, material, ['encrypt']),
        plaintext,
      ),
    );
    return { revision, keyVersion, nonce, ciphertext, expiresAt: context.expiresAt };
  } catch (error) {
    if (error instanceof RuntimeStorageError) throw error;
    throw failure('invalid_key');
  }
}
