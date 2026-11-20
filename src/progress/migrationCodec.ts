import type { Attempt } from '../attempts';
import { eventPayload } from './memberEventCodec';
export type QuestionRef = { id: string; revision: number };
export const replacedCertifications = new Map([
  ['dva-c02', 'dva-c03'],
  ['sap-c02', 'sap-c03'],
]);
function uuid(bytes: Uint8Array) {
  bytes[6] = (bytes[6] & 15) | 80;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export async function stableId(value: string) {
  return uuid(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))).slice(0, 16),
  );
}
export function canonicalAttemptKey(attempt: Attempt) {
  return JSON.stringify({
    schemaVersion: attempt.schemaVersion,
    questionId: attempt.questionId,
    questionRevision: attempt.questionRevision,
    sourceVersion: attempt.sourceVersion,
    category: attempt.category,
    mode: attempt.mode,
    examId: attempt.examId ?? '',
    answeredAt: attempt.answeredAt,
    selected: attempt.selected,
    correct: attempt.correct,
    ...(attempt.format === undefined ? {} : { format: attempt.format }),
    isCorrect: attempt.isCorrect,
    durationMs: attempt.durationMs,
    attemptNumber: attempt.attemptNumber,
    priorIncorrectCount: attempt.priorIncorrectCount,
    reviewCorrect: attempt.reviewCorrect,
    reward: attempt.reward,
  });
}
export async function stableAttemptId(attempt: Attempt, occurrence: number) {
  return stableId(`legacy-attempt-v2:${canonicalAttemptKey(attempt)}:${occurrence}`);
}
export async function fingerprint(raw: string) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw)))]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
export function payload(attempt: Attempt, certificationId: string, eventId: string) {
  return eventPayload({ ...attempt, certificationId, eventId });
}
export function sameStrings(left: readonly string[], right: readonly string[]) {
  return (
    left.length === right.length &&
    [...left].sort().every((value, index) => value === [...right].sort()[index])
  );
}
export function ref(key: string): QuestionRef | undefined {
  try {
    const value: unknown = JSON.parse(key);
    return Array.isArray(value) && typeof value[0] === 'string' && Number.isInteger(value[1])
      ? { id: value[0], revision: value[1] as number }
      : undefined;
  } catch {
    return undefined;
  }
}
