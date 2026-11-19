import { useEffect, useState } from 'react';
import type { ExamBlueprint } from './certifications';
import {
  canStartExam,
  getResponse,
  isAnswered,
  newExam,
  readExam,
  storeExam,
  type ExamResponse,
} from './exam';
import type { Attempt } from './history';
import { questionKey, type Question } from './questions';
import { useExamSubmission } from './useExamSubmission';
import { useStoredExam } from './useStoredExam';

export function useExamSession({
  bank,
  archivedBank,
  history,
  onSaved,
  blueprint,
  examKey,
  practiceQuestions,
  onStart,
}: {
  bank: Question[];
  practiceQuestions: Question[];
  archivedBank: Question[];
  blueprint: ExamBlueprint;
  examKey: string;
  history: Attempt[];
  onStart: () => void;
  onSaved: (history: Attempt[], indexFailed: boolean) => void;
}) {
  const { draft, setDraft, error, setError, activeSince } = useStoredExam(examKey);
  const [now, setNow] = useState(Date.now);
  const byKey = new Map(
    [...archivedBank, ...practiceQuestions, ...bank].map((question) => [
      questionKey(question),
      question,
    ]),
  );
  const questions =
    draft?.order
      .map((key) => byKey.get(key))
      .filter((question): question is Question => question !== undefined) ?? [];
  const correctRevision = draft?.order.length === questions.length;
  const question = questions[draft?.position ?? 0];
  const key = question ? questionKey(question) : '';
  const attempts = draft ? history.filter((attempt) => attempt.examId === draft.id) : [];
  const completed = attempts.length > 0;
  const expired = !!draft && now >= draft.deadline;
  const available = canStartExam(bank, blueprint);
  const unanswered = draft ? questions.filter((item) => !isAnswered(draft, item)).length : 0;
  useEffect(() => {
    if (!draft?.id || completed || expired) return;
    const tick = () => setNow(Date.now());
    const interval = window.setInterval(tick, 250);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [draft?.id, completed, expired]);
  const { submitting, dialog, pending, failedAuto, submit } = useExamSubmission({
    draft,
    questions,
    correctRevision,
    completed,
    expired,
    examKey,
    onSaved,
    activeSince,
    setError,
  });
  function start(count: number) {
    if (!available) return;
    try {
      const current = readExam(examKey);
      if (current && !history.some((attempt) => attempt.examId === current.id)) {
        setDraft(current);
        return;
      }
      const next = newExam(bank, blueprint, Date.now(), count);
      storeExam(examKey, next);
      setDraft(next);
      setNow(Date.now());
      activeSince.current = Date.now();
      failedAuto.current = false;
      onStart();
      setError('');
    } catch {
      setError('examSaveFailed');
    }
  }
  function update(position: number, patch: Partial<ExamResponse> = {}) {
    const at = Date.now();
    if (!draft || at >= draft.deadline || pending.current) {
      setNow(at);
      return;
    }
    try {
      const current = readExam(examKey);
      if (!current || current.id !== draft.id || current.position !== draft.position) return;
      const response = getResponse(current, key);
      const next = {
        ...current,
        position,
        responses: {
          ...current.responses,
          [key]: {
            ...response,
            ...patch,
            durationMs: response.durationMs + Math.max(0, at - activeSince.current),
          },
        },
      };
      storeExam(examKey, next);
      activeSince.current = at;
      setDraft(next);
      setError('');
    } catch {
      setError('answerSaveFailed');
    }
  }
  return {
    draft,
    now,
    error,
    byKey,
    questions,
    correctRevision,
    question,
    key,
    attempts,
    completed,
    expired,
    available,
    unanswered,
    submitting,
    dialog,
    submit,
    start,
    update,
  };
}
