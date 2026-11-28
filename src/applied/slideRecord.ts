import { appliedSlidePrefix } from '../learningStorage';
import { canPersistGuestProgress } from '../progress/guest';

export const appliedAnswerLimit = 2000;

export type AppliedSlideRecord = {
  stepId: string;
  reflection?: { stepId: string; answer: string };
};

export function appliedSlideKey(lessonId: string, accountId?: string) {
  const owner = accountId ? `account.${encodeURIComponent(accountId)}` : 'guest';
  return `${appliedSlidePrefix}${owner}.${lessonId}`;
}

export function canStoreAppliedSlides(accountId?: string) {
  try {
    return Boolean(accountId) || canPersistGuestProgress(localStorage);
  } catch {
    return false;
  }
}

export function readAppliedSlide(
  key: string,
  steps: readonly string[],
  reflectionStep: string | undefined,
  allowed: boolean,
): AppliedSlideRecord {
  const initial = { stepId: steps[0] };
  if (!allowed) return initial;

  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return initial;
    const saved: unknown = JSON.parse(raw);
    if (!saved || typeof saved !== 'object' || !('stepId' in saved)) return initial;
    if (typeof saved.stepId !== 'string' || !steps.includes(saved.stepId)) return initial;
    const base = { stepId: saved.stepId };
    if (!('reflection' in saved) || !saved.reflection || typeof saved.reflection !== 'object')
      return base;
    const reflection = saved.reflection;
    if (
      !reflectionStep ||
      !('stepId' in reflection) ||
      reflection.stepId !== reflectionStep ||
      !('answer' in reflection) ||
      typeof reflection.answer !== 'string' ||
      !reflection.answer.trim() ||
      reflection.answer.length > appliedAnswerLimit
    )
      return base;
    return { ...base, reflection: { stepId: reflectionStep, answer: reflection.answer } };
  } catch {
    return initial;
  }
}

export function storeAppliedSlide(key: string, record: AppliedSlideRecord) {
  try {
    const payload = JSON.stringify(record);
    localStorage.setItem(key, payload);
    return localStorage.getItem(key) === payload;
  } catch {
    return false;
  }
}
