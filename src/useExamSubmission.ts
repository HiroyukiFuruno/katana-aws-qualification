import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { getResponse, readExam, type ExamDraft } from './exam';
import { saveExam, type Attempt } from './history';
import type { Message } from './messages';
import { questionKey, type Question } from './questions';

export function useExamSubmission({
  draft,
  questions,
  correctRevision,
  completed,
  expired,
  examKey,
  onSaved,
  activeSince,
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
  setError: (error: Message | '') => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = useRef(false);
  const failedAuto = useRef(false);
  const submit = useCallback(async () => {
    if (!draft || !correctRevision || completed || pending.current) return;
    pending.current = true;
    setSubmitting(true);
    setError('');
    dialog.current?.close();
    try {
      const current = readExam(examKey);
      if (!current || current.id !== draft.id) throw new Error('Stale exam');
      const end = Math.min(Date.now(), current.deadline);
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
    } catch {
      failedAuto.current = true;
      setError('examGradeFailed');
    } finally {
      pending.current = false;
      setSubmitting(false);
    }
  }, [draft, correctRevision, completed, questions, onSaved, examKey, activeSince, setError]);
  useEffect(() => {
    if (expired && correctRevision && !completed && !failedAuto.current) void submit();
  }, [expired, correctRevision, completed, submit]);
  return { submitting, dialog, pending, failedAuto, submit };
}
