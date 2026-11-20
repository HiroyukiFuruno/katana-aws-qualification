import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { type ExamDraft, getResponse, readExam } from './exam';
import { elapsedExamMs } from './examClock';
import { ExamSubmissionAttempt } from './examSubmissionAttempt';
import { finalMemberDraft } from './examSubmissionMember';
import { type Attempt, saveExam } from './history';
import type { Message } from './messages';
import { ExamFinalizationCache } from './progress/examFinalization';
import type { ProgressStore } from './progress/storeTypes';
import { type Question, questionKey } from './questions';

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
  history,
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
  history: Attempt[];
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
      const member = progressStore?.getSnapshot().owner.kind === 'member';
      const current = member ? draft : readExam(examKey);
      if (!current || current.id !== draft.id) throw new Error('Stale exam');
      const serverNow =
        member && progressStore ? Date.parse(await progressStore.readExamClock()) : Date.now();
      if (!Number.isFinite(serverNow)) throw new Error('Invalid exam server time');
      const end = Math.min(serverNow, current.deadline);
      if (member && progressStore) {
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
        }
        const submission = finalization.current.getOrCreate(
          history,
          certificationId,
          finalizationDraft,
          questions,
          end,
        );
        await progressStore.finalizeExam(finalizationDraft, submission.events);
        onSaved(progressStore.getSnapshot().attempts, false);
      } else {
        const result = await saveExam(
          examKey,
          current.id,
          current.deadline,
          questions.map((item, index) => {
            const response = getResponse(current, questionKey(item));
            return {
              question: item,
              selected: response.selected,
              selectedAt: response.selectedAt,
              durationMs:
                response.durationMs +
                (index === current.position ? elapsedExamMs(activeSince.current) : 0),
            };
          }),
        );
        onSaved(result.history, result.indexFailed);
      }
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
    history,
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
