import { useEffect, useState } from 'react';
import type { ExamBlueprint } from './certifications';
import { isAnswered } from './exam';
import type { Attempt } from './history';
import { getActiveProgressStore } from './history';
import { type Question, questionKey } from './questions';
import { useExamDraftControls } from './useExamDraftControls';
import { useExamSubmission } from './useExamSubmission';
import { useStoredExam } from './useStoredExam';

type ExamSessionInput = {
  archivedBank: Question[];
  bank: Question[];
  blueprint: ExamBlueprint;
  certificationId: string;
  examKey: string;
  history: Attempt[];
  onSaved: (history: Attempt[], indexFailed: boolean) => void;
  onStart: () => void;
  practiceQuestions: Question[];
};

export function useExamSession({
  archivedBank,
  bank,
  blueprint,
  certificationId,
  examKey,
  history,
  onSaved,
  onStart,
  practiceQuestions,
}: ExamSessionInput) {
  const progressStore = getActiveProgressStore();
  const { draft, setDraft, error, setError, activeSince } = useStoredExam(examKey, certificationId);
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
  const { submitting, dialog, pending, failedAuto, submit } = useExamSubmission({
    activeSince,
    certificationId,
    completed,
    correctRevision,
    draft,
    examKey,
    expired,
    history,
    onSaved,
    progressStore,
    questions,
    setError,
  });
  const { available, start, update } = useExamDraftControls({
    activeSince,
    bank,
    blueprint,
    certificationId,
    draft,
    examKey,
    failedAuto,
    history,
    onStart,
    progressStore,
    setDraft,
    setError,
    setNow,
  });
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
  return {
    attempts,
    available,
    byKey,
    completed,
    correctRevision,
    dialog,
    draft,
    error,
    expired,
    key,
    now,
    question,
    questions,
    start,
    submit,
    submitting,
    unanswered,
    update: (position: number, patch = {}) => (pending.current ? undefined : update(position, patch)),
  };
}
