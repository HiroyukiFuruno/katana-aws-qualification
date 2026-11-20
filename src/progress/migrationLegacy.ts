import type { Attempt } from '../attempts';
import type { LegacySourceName } from './migrationTypes';

export type LegacyAttempt = Attempt & { mode: 'study' | 'review' | 'exam' };
export type LegacyDraft = {
  id: string;
  deadline: number;
  order: string[];
  position: number;
  responses: Record<
    string,
    { selected: string[]; flagged: boolean; durationMs: number; selectedAt?: number }
  >;
};
export type LegacyProfile = { earned: string[]; answers: Record<string, number> };

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
function integer(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}
function attempt(value: unknown): value is LegacyAttempt {
  return (
    object(value) &&
    value.schemaVersion === 1 &&
    typeof value.questionId === 'string' &&
    integer(value.questionRevision) &&
    value.questionRevision > 0 &&
    typeof value.answeredAt === 'string' &&
    Array.isArray(value.selected) &&
    value.selected.every((item) => typeof item === 'string') &&
    Array.isArray(value.correct) &&
    value.correct.every((item) => typeof item === 'string') &&
    typeof value.category === 'string' &&
    typeof value.sourceVersion === 'string' &&
    ['study', 'review', 'exam'].includes(value.mode as string) &&
    typeof value.isCorrect === 'boolean' &&
    integer(value.durationMs) &&
    value.durationMs >= 0 &&
    integer(value.attemptNumber) &&
    value.attemptNumber > 0 &&
    integer(value.priorIncorrectCount) &&
    value.priorIncorrectCount >= 0 &&
    (value.reviewCorrect === null || typeof value.reviewCorrect === 'boolean') &&
    (value.reward === 0 || value.reward === 1) &&
    (value.mode !== 'exam' || typeof value.examId === 'string')
  );
}
export function history(raw: string): { rows: LegacyAttempt[]; errors: number } {
  try {
    const parsed: unknown = raw.trim().startsWith('[')
      ? JSON.parse(raw)
      : raw
          .split('\n')
          .filter(Boolean)
          .map((line) => JSON.parse(line));
    if (!Array.isArray(parsed)) return { rows: [], errors: 1 };
    const rows = parsed.filter(attempt);
    return { rows, errors: parsed.length - rows.length };
  } catch {
    return { rows: [], errors: 1 };
  }
}
export function draft(raw: string): LegacyDraft | undefined {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      !object(parsed) ||
      typeof parsed.id !== 'string' ||
      !Array.isArray(parsed.order) ||
      !parsed.order.every((item) => typeof item === 'string') ||
      !integer(parsed.deadline) ||
      !integer(parsed.position) ||
      parsed.position < 0 ||
      parsed.position >= parsed.order.length ||
      !object(parsed.responses) ||
      !Object.values(parsed.responses).every(
        (value) =>
          object(value) &&
          Array.isArray(value.selected) &&
          value.selected.every((item) => typeof item === 'string') &&
          typeof value.flagged === 'boolean' &&
          integer(value.durationMs) &&
          value.durationMs >= 0 &&
          (value.selectedAt === undefined || integer(value.selectedAt)),
      )
    )
      return undefined;
    return parsed as LegacyDraft;
  } catch {
    return undefined;
  }
}
export function profile(raw: string): LegacyProfile | undefined {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      !object(parsed) ||
      !Array.isArray(parsed.earned) ||
      !object(parsed.answers) ||
      !parsed.earned.every((value) => typeof value === 'string') ||
      !Object.values(parsed.answers).every(Number.isInteger)
    )
      return undefined;
    return { earned: parsed.earned as string[], answers: parsed.answers as Record<string, number> };
  } catch {
    return undefined;
  }
}
export function incorrectCookie(raw: string) {
  try {
    const ids: unknown = JSON.parse(raw);
    return Array.isArray(ids) &&
      ids.length > 0 &&
      ids.every((id) => typeof id === 'string' && id.length > 0) &&
      new Set(ids).size === ids.length
      ? ids
      : undefined;
  } catch {
    return undefined;
  }
}
export function legacyRows(source: LegacySourceName, raw: string) {
  if (source === 'history-local-storage') {
    const parsed = history(raw);
    return { rows: parsed.rows.length, errors: parsed.errors };
  }
  if (source === 'profile-local-storage')
    return { rows: profile(raw) ? 1 : 0, errors: profile(raw) ? 0 : 1 };
  if (source === 'exam-draft-local-storage')
    return { rows: draft(raw) ? 1 : 0, errors: draft(raw) ? 0 : 1 };
  return { rows: 1, errors: 0 };
}
