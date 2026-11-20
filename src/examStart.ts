import type { ExamBlueprint } from './certifications';
import { type ExamDraft, newExam } from './exam';
import type { Attempt } from './history';
import type { ProgressStore } from './progress/storeTypes';
import type { Question } from './questions';

type StartInput = {
  bank: Question[];
  blueprint: ExamBlueprint;
  certificationId: string;
  draft: ExamDraft | undefined;
  examKey: string;
  history: Attempt[];
  store: ProgressStore | null | undefined;
  count: number;
};

export async function loadOrStartExam({
  bank,
  blueprint,
  certificationId,
  draft,
  examKey,
  history,
  store,
  count,
}: StartInput) {
  if (!store) throw new Error('Progress store is unavailable.');
  const owner = store.getSnapshot().owner;
  const current =
    owner?.kind === 'member'
      ? await store.loadExam(certificationId)
      : owner?.kind === 'guest'
        ? store.readGuestExam(examKey)
        : draft;
  if (current && !history.some((attempt) => attempt.examId === current.id)) return current;
  const next = newExam(bank, blueprint, Date.now(), count);
  if (owner?.kind === 'member') {
    return store.startExam(
      next,
      certificationId,
      bank[0]?.version ?? 'current',
      next.deadline - Date.now(),
    );
  }
  if (owner?.kind === 'guest') {
    await store.saveGuestExam(examKey, next);
    return next;
  }
  throw new Error('Progress store is unavailable.');
}
