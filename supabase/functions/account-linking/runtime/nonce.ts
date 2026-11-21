import { type Envelope, failure } from './slots.ts';
import type { RuntimeContext, RuntimeRecord } from './types.ts';

type Current = { record: RuntimeRecord | null; envelope: Envelope };
export type NonceAccess = {
  context: RuntimeContext;
  run<T>(operation: () => Promise<T>): Promise<T>;
  mutate<T>(operation: () => Promise<T>): Promise<T>;
  read(): Promise<Current>;
  write(record: RuntimeRecord | null, envelope: Envelope): Promise<void>;
  matches(nonce: string, expected: Uint8Array): Promise<void>;
};

export function copyHash(value: Uint8Array): Uint8Array {
  try {
    if (!(value instanceof Uint8Array) || value.length !== 32) throw failure('nonce_mismatch');
    return new Uint8Array(value);
  } catch {
    throw failure('nonce_mismatch');
  }
}

export async function matchHash(
  crypto: Crypto,
  live: () => Promise<void>,
  nonce: string,
  expected: Uint8Array,
): Promise<void> {
  await live();
  const pairs = nonce.match(/.{2}/g);
  if (!pairs) throw failure('nonce_mismatch');
  const raw = Uint8Array.from(pairs.map((part) => Number.parseInt(part, 16)));
  const actual = new Uint8Array(await crypto.subtle.digest('SHA-256', raw));
  await live();
  if (actual.length !== expected.length || !actual.every((value, index) => value === expected[index]))
    throw failure('nonce_mismatch');
}

export async function initialize(
  access: NonceAccess,
  nonce: string,
  expected: Uint8Array,
): Promise<void> {
  return access.mutate(() =>
    access.run(async () => {
      if (access.context.purpose !== 'leg' || !/^[0-9a-f]{64}$/.test(nonce))
        throw failure('nonce_mismatch');
      await access.matches(nonce, expected);
      const current = await access.read();
      if (!current.record) return access.write(null, { slots: {}, ingestNonce: nonce });
      if (current.envelope.ingestNonce !== nonce) throw failure('nonce_mismatch');
      await access.matches(nonce, expected);
    }),
  );
}

export async function get(access: NonceAccess, expected: Uint8Array): Promise<string> {
  return access.run(async () => {
    const nonce = (await access.read()).envelope.ingestNonce;
    if (!nonce) throw failure('nonce_missing');
    await access.matches(nonce, expected);
    return nonce;
  });
}

export async function clear(access: NonceAccess, expected: Uint8Array): Promise<void> {
  return access.mutate(() =>
    access.run(async () => {
      if (access.context.purpose !== 'proof') throw failure('nonce_mismatch');
      const current = await access.read();
      const nonce = current.envelope.ingestNonce;
      if (!current.record || !nonce) throw failure('nonce_missing');
      await access.matches(nonce, expected);
      await access.write(current.record, { slots: current.envelope.slots });
    }),
  );
}
