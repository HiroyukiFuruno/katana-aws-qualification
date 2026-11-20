import type { Attempt } from '../attempts';

const modes = new Set<Attempt['mode']>(['study', 'review', 'exam']);

function stringArray(value: unknown) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function validAttempt(value: unknown): value is Attempt {
  if (!value || typeof value !== 'object') return false;
  const attempt = value as Record<string, unknown>;
  return (
    attempt.schemaVersion === 1 &&
    typeof attempt.questionId === 'string' &&
    Number.isInteger(attempt.questionRevision) &&
    typeof attempt.category === 'string' &&
    typeof attempt.sourceVersion === 'string' &&
    typeof attempt.answeredAt === 'string' &&
    Number.isFinite(Date.parse(attempt.answeredAt)) &&
    stringArray(attempt.selected) &&
    stringArray(attempt.correct) &&
    (attempt.format === undefined || attempt.format === 'ordering' || attempt.format === 'matching') &&
    typeof attempt.isCorrect === 'boolean' &&
    Number.isInteger(attempt.durationMs) &&
    Number.isInteger(attempt.attemptNumber) &&
    Number.isInteger(attempt.priorIncorrectCount) &&
    typeof attempt.mode === 'string' &&
    modes.has(attempt.mode as Attempt['mode']) &&
    (attempt.examId === undefined || typeof attempt.examId === 'string') &&
    (attempt.reviewCorrect === null || typeof attempt.reviewCorrect === 'boolean') &&
    (attempt.reward === 0 || attempt.reward === 1)
  );
}

export function parseStoredAttempts(value: string | null) {
  if (value === null) return { attempts: [], corruptRows: 0 };
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return { attempts: [], corruptRows: 1 };
    const attempts = parsed.filter(validAttempt);
    return { attempts, corruptRows: parsed.length - attempts.length };
  } catch {
    return { attempts: [], corruptRows: 1 };
  }
}
