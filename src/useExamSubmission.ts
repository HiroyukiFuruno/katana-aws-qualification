import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { type ExamDraft, getResponse, readExam } from './exam';
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
  setError: (error: Message | '') => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = useRef(false);
  const failedAuto = useRef(false);
  const finalization = useRef(new ExamFinalizationCache());
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
      const end = Math.min(Date.now(), current.deadline);
      if (member && progressStore) {
        const key = current.order[current.position];
        const response = getResponse(current, key);
        let finalizationDraft = current;
        if (response.selected.length) {
          const savedResponse = {
            ...response,
            durationMs: response.durationMs + Math.max(0, end - activeSince.current),
          };
          finalizationDraft = await progressStore.saveExamResponse(
            {
              ...current,
              responses: { ...current.responses, [key]: savedResponse },
            },
            current.position,
            key,
            savedResponse,
          );
        }
        const submissionDraft = {
          ...finalizationDraft,
        };
        const submission = finalization.current.getOrCreate(
          history,
          certificationId,
          submissionDraft,
          questions,
          end,
        );
        await progressStore.finalizeExam(finalizationDraft, submission.events);
        onSaved([...history, ...submission.attempts], false);
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
                (index === current.position ? Math.max(0, end - activeSince.current) : 0),
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
    setError,
  ]);
  useEffect(() => {
    if (expired && correctRevision && !completed && !failedAuto.current) void submit();
  }, [expired, correctRevision, completed, submit]);
  return { submitting, dialog, pending, failedAuto, submit };
}
