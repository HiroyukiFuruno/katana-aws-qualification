import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { type ExamDraft, getResponse } from './exam';
import { elapsedExamMs } from './examClock';
import { ExamSubmissionAttempt } from './examSubmissionAttempt';
import { finalMemberDraft } from './examSubmissionMember';
import { type Attempt, withHistoryLock } from './history';
import type { Message } from './messages';
import { ExamFinalizationCache } from './progress/examFinalization';
import type { ProgressStore } from './progress/storeTypes';
import type { Question } from './questions';

export function useExamSubmission({
  draft,
  questions,
  correctRevision,
  completed,
  expired,
  examKey,
  onSaved,
  activeSince,
  certificationId,
  progressStore,
  setDraft,
  setError,
}: {
  draft: ExamDraft | undefined;
  questions: Question[];
  correctRevision: boolean;
  completed: boolean;
  expired: boolean;
  examKey: string;
  onSaved: (history: Attempt[], indexFailed: boolean) => void;
  activeSince: RefObject<number>;
  certificationId: string;
  progressStore: ProgressStore | null | undefined;
  setDraft: (draft: ExamDraft) => void;
  setError: (error: Message | '') => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = useRef(false);
  const failedAuto = useRef(false);
  const finalization = useRef(new ExamFinalizationCache());
  const finalizationAttempt = useRef(new ExamSubmissionAttempt());
  const submit = useCallback(async () => {
    if (!draft || !correctRevision || completed || pending.current) return;
    pending.current = true;
    setSubmitting(true);
    setError('');
    dialog.current?.close();
    try {
      const result = await withHistoryLock(async () => {
        if (!progressStore) throw new Error('Progress store is unavailable.');
        const member = progressStore.getSnapshot().owner.kind === 'member';
        const current = member ? draft : progressStore.readGuestExam(examKey);
        if (!current || current.id !== draft.id) throw new Error('Stale exam');
        const serverNow = member ? Date.parse(await progressStore.readExamClock()) : Date.now();
        if (!Number.isFinite(serverNow)) throw new Error('Invalid exam server time');
        const end = Math.min(serverNow, current.deadline);
        if (member) {
          const key = current.order[current.position];
          const retryDraft = finalizationAttempt.current.retry(current);
          let finalizationDraft = retryDraft ?? current;
          if (!retryDraft) {
            finalization.current = new ExamFinalizationCache();
            const response = getResponse(current, key);
            finalizationDraft = await finalMemberDraft(
              progressStore,
              certificationId,
              current,
              key,
              response,
              elapsedExamMs(activeSince.current),
              serverNow,
            );
            finalizationDraft = finalizationAttempt.current.prepare(finalizationDraft);
            setDraft(finalizationDraft);
            activeSince.current = performance.now();
          }
          const submission = finalization.current.getOrCreate(
            progressStore.getSnapshot().attempts,
            certificationId,
            finalizationDraft,
            questions,
            end,
          );
          await progressStore.finalizeExam(finalizationDraft, submission.events);
          return { history: progressStore.getSnapshot().attempts, indexFailed: false };
        }
        const retryDraft = finalizationAttempt.current.retryGuest(current);
        const response = getResponse(current, current.order[current.position]);
        const finalizationDraft = retryDraft ?? {
          ...current,
          responses: {
            ...current.responses,
            [current.order[current.position]]: {
              ...response,
              durationMs: response.selected.length
                ? response.durationMs + elapsedExamMs(activeSince.current)
                : 0,
            },
          },
        };
        if (!retryDraft) {
          finalization.current = new ExamFinalizationCache();
          await progressStore.saveGuestExam(examKey, finalizationDraft);
          finalizationAttempt.current.prepareGuest(finalizationDraft);
          setDraft(finalizationDraft);
          activeSince.current = performance.now();
        }
        const submission = finalization.current.getOrCreate(
          progressStore.getSnapshot().attempts,
          certificationId,
          finalizationDraft,
          questions,
          end,
        );
        const saved = await progressStore.finalizeGuestExam(current.id, submission.attempts);
        return { history: saved.history, indexFailed: false };
      });
      onSaved(result.history, result.indexFailed);
    } catch {
      failedAuto.current = true;
      setError('examGradeFailed');
    } finally {
      pending.current = false;
      setSubmitting(false);
    }
  }, [
    activeSince,
    certificationId,
    completed,
    correctRevision,
    draft,
    examKey,
    onSaved,
    progressStore,
    questions,
    setDraft,
    setError,
  ]);
  useEffect(() => {
    if (expired && correctRevision && !completed && !failedAuto.current) void submit();
  }, [expired, correctRevision, completed, submit]);
  return { submitting, dialog, pending, failedAuto, submit };
}
