import { useEffect, useState } from 'react';
import type { CoursePage } from './CourseNavigation';
import {
  exportHistory,
  historyKey,
  readHistory,
  resetHistory,
  saveAttempt,
  statsFor,
  type Attempt,
} from './history';
import type { Message } from './messages';
import { usePreferences } from './preferences';
import { questionKey, type Question } from './questions';

export type PracticeSession = { questions: Question[]; index: number; correct: number };

export function useCourseProgress(questions: Question[], archivedBank: Question[]) {
  const { t } = usePreferences();
  const [history, setHistory] = useState<Attempt[]>([]);
  const [page, setPage] = useState<CoursePage>('study');
  const [session, setSession] = useState<PracticeSession>();
  const [notice, setNotice] = useState<Message | ''>('');
  const [busy, setBusy] = useState(false);
  const question = session?.questions[session.index];

  const known = new Map(questions.map((item) => [questionKey(item), item]));
  const courseIds = new Set([...known.values(), ...archivedBank].map((item) => item.id));
  const courseHistory = history.filter((attempt) => courseIds.has(attempt.questionId));
  const review = [...known.values()]
    .map((item) => ({ question: item, ...statsFor(courseHistory, item) }))
    .filter((stats) => stats.wrong > 0)
    .sort((a, b) => b.wrong - a.wrong);
  const answerCount = courseHistory.length;
  const rate = answerCount
    ? `${Math.round((100 * courseHistory.filter((attempt) => attempt.isCorrect).length) / answerCount)}%`
    : '—';

  useEffect(() => {
    function refresh() {
      try {
        setHistory(readHistory());
      } catch {
        setNotice('historyFailed');
      }
    }
    function onStorage(event: StorageEvent) {
      if (event.key === historyKey || event.key === null) {
        refresh();
        if (event.newValue === null) setSession(undefined);
      }
    }
    refresh();
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  function navigate(next: CoursePage) {
    if (page === next) return;
    setPage(next);
    setSession(undefined);
    setNotice('');
  }
  const start = (items: Question[]) => setSession({ questions: items, index: 0, correct: 0 });
  const close = () => setSession(undefined);
  const next = () => setSession((current) => current && { ...current, index: current.index + 1 });

  async function answer(selected: string[], elapsed: number) {
    if (!question || (page !== 'study' && page !== 'review')) throw new Error(t('questionMissing'));
    setBusy(true);
    try {
      const result = await saveAttempt(question, selected, page, elapsed);
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
