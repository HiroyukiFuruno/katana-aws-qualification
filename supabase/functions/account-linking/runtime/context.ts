import { failure } from './slots.ts';
import type { RuntimeContext, RuntimeRecord, RuntimeWriteGuard } from './types.ts';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function fixedContext(source: RuntimeContext): RuntimeContext {
  try {
    const context = { ...source };
    const maximum = context.purpose === 'leg' ? 180_000 : 600_000;
    if (
      (context.purpose !== 'leg' && context.purpose !== 'proof') ||
      !uuid.test(context.intentId) ||
      !uuid.test(context.legId) ||
      !Number.isSafeInteger(context.attempt) ||
      context.attempt < 1 ||
      context.attempt > 3 ||
      !Number.isSafeInteger(context.issuedAt) ||
      !Number.isSafeInteger(context.expiresAt) ||
      context.issuedAt <= 0 ||
      context.expiresAt <= context.issuedAt ||
      context.expiresAt - context.issuedAt > maximum ||
      context.storageKey !== `kaq-proof:${context.intentId}:${context.legId}:${context.attempt}`
    )
      throw failure('invalid_context');
    return Object.freeze(context);
  } catch {
    throw failure('invalid_context');
  }
}

export function checkedNow(now: number): number {
  if (!Number.isSafeInteger(now) || now <= 0) throw failure('invalid_context');
  return now;
}

export function promotionContexts(
  from: RuntimeContext,
  to: RuntimeContext,
  record: RuntimeRecord,
  revision: number,
): [RuntimeContext, RuntimeContext] {
  try {
    const source = fixedContext(from);
    const target = fixedContext(to);
    const fields = ['intentId', 'legId', 'attempt', 'storageKey', 'issuedAt'] as const;
    if (
      source.purpose !== 'leg' ||
      target.purpose !== 'proof' ||
      fields.some((field) => source[field] !== target[field]) ||
      target.expiresAt < source.expiresAt ||
      record.expiresAt !== source.expiresAt ||
      !Number.isSafeInteger(record.revision) ||
      !Number.isSafeInteger(revision) ||
      revision !== record.revision + 1
    )
      throw failure('invalid_context');
    return [source, target];
  } catch {
    throw failure('invalid_context');
  }
}

export function writeGuard(context: RuntimeContext): RuntimeWriteGuard {
  return {
    purpose: context.purpose,
    intentId: context.intentId,
    legId: context.legId,
    attempt: context.attempt,
    storageKey: context.storageKey,
    issuedAt: context.issuedAt,
    expiresAt: context.expiresAt,
  };
}
