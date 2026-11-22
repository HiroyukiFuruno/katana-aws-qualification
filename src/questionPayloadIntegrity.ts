function declaredHash(value: unknown, filename: string) {
  if (value && typeof value === 'object' && !Array.isArray(value) && Object.hasOwn(value, filename)) {
    const hash = (value as Record<string, unknown>)[filename];
    if (typeof hash === 'string' && /^[a-f0-9]{64}$/u.test(hash)) return hash;
  }
  throw new Error('invalidQuestionData');
}

export async function questionPayloadHash(value: unknown) {
  const payload = JSON.stringify(value);
  if (typeof payload !== 'string') throw new Error('invalidQuestionData');
  const bytes = new TextEncoder().encode(payload);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function verifyQuestionPayloads(
  filename: string,
  canonical: Question[],
  translated: unknown,
  sourceManifest: unknown,
  payloadManifest: unknown,
) {
  const expectedSource = declaredHash(sourceManifest, filename);
  const expectedPayload = declaredHash(payloadManifest, filename);
  const [source, payload] = await Promise.all([
    questionPayloadHash(canonical.map(questionTranslationSource)),
    questionPayloadHash(translated),
  ]);
  if (source !== expectedSource || payload !== expectedPayload) throw new Error('invalidQuestionData');
}

import type { Question } from './questions';
import { questionTranslationSource } from './questionTranslationSource';
