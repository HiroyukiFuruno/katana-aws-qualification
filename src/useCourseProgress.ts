import { useEffect, useState } from 'react';
import type { CoursePage } from './CourseNavigation';
import { coursePageFromSearch } from './coursePageQuery';
import {
  type Attempt,
  exportHistory,
  getActiveProgressStore,
  readHistory,
  resetHistory,
  saveAttempt,
} from './history';
import type { Message } from './messages';
import { usePreferences } from './preferences';
import { useLearningHistory } from './progress/useLearningHistory';
import { questionKey, type Question } from './questions';
import { randomizePracticeQuestions } from './randomization';

import {
  localizePracticeSession,
  practiceMetrics,
  practiceQuestion,
  type PracticeSession,
} from './practiceSession';

export function useCourseProgress(
  certificationId: string,
  questions: Question[],
  archivedBank: Question[],
) {
  const progressStore = getActiveProgressStore();
  const { t } = usePreferences();
  const {
    attempts: history,
    setAttempts: setHistory,
    historyError,
    resetVersion,
  } = useLearningHistory();
  const [page, setPage] = useState<CoursePage>(() => coursePageFromSearch(location.search));
  const [session, setSession] = useState<PracticeSession>();
  const [notice, setNotice] = useState<Message | ''>('');
  const [busy, setBusy] = useState(false);
  const known = new Map(questions.map((item) => [questionKey(item), item]));
  const current = session?.questions[session.index];
  const question = practiceQuestion(current, known);
  const { courseIds, review, answerCount, rate } = practiceMetrics(
    history,
    [...known.values()],
    archivedBank,
  );

  useEffect(() => {
    if (historyError) setNotice('historyFailed');
  }, [historyError]);
  useEffect(() => {
    if (resetVersion > 0) setSession(undefined);
  }, [resetVersion]);

  useEffect(() => {
    if (!questions.length) return;
    setSession((current) => localizePracticeSession(current, questions));
  }, [questions]);

  function navigate(next: CoursePage) {
    if (page === next) return;
    setPage(next);
    setSession(undefined);
    setNotice('');
  }
  const start = (items: Question[]) =>
    setSession({ questions: randomizePracticeQuestions(items), index: 0, correct: 0 });
  const close = () => setSession(undefined);
  const next = () => setSession((current) => current && { ...current, index: current.index + 1 });

  async function answer(selected: string[], elapsed: number) {
    if (!question || (page !== 'study' && page !== 'review')) throw new Error(t('questionMissing'));
    setBusy(true);
    try {
      const result = await saveAttempt(
        question,
        selected,
        page,
        elapsed,
        certificationId,
        progressStore,
      );
      setHistory(result.history);
      setSession(
        (current) => current && { ...current, correct: current.correct + result.attempt.reward },
      );
      if (result.indexFailed) setNotice('wrongIndexFailed');
      return result.attempt;
    } finally {
      setBusy(false);
    }
  }

  function updateExamHistory(updated: Attempt[], indexFailed: boolean) {
    setHistory(updated);
    if (indexFailed) setNotice('wrongIndexFailed');
  }

  async function reset() {
    setBusy(true);
    try {
      await resetHistory();
      setHistory([]);
      setSession(undefined);
      setPage('study');
      setNotice('resetDone');
    } catch {
      setNotice('resetFailed');
    } finally {
      setBusy(false);
    }
  }

  function download() {
    try {
      const current = readHistory().filter((attempt) => courseIds.has(attempt.questionId));
      if (current.length) exportHistory(current);
    } catch {
      setNotice('exportFailed');
    }
  }

  return {
    history,
    page,
    session,
    question,
    translationError: Boolean(
      session?.translationError || session?.questions.some((item) => !known.has(questionKey(item))),
    ),
    notice,
    busy,
    review,
    answerCount,
    rate,
    navigate,
    start,
    close,
    next,
    answer,
    updateExamHistory,
    reset,
    download,
  };
}
