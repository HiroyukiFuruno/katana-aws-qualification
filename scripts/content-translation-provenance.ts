import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access } from 'node:fs/promises';

export const contentPayloadHash = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function updateContentPayloadManifest(
  manifest: Record<string, string>,
  path: string,
  value: unknown,
) {
  return { ...manifest, [path]: contentPayloadHash(value) };
}

export function assertContentPayloadHash(value: unknown, expected: unknown, context: string) {
  assert(
    typeof expected === 'string' && expected,
    `${context}: missing published translation payload hash`,
  );
  assert.equal(contentPayloadHash(value), expected, `${context}: published translation payload changed`);
}

export async function directoryExists(path: string) {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return false;
    throw error;
  }
}
