import { useEffect, useRef, useState } from 'react';
import type { ExamDraft } from './exam';
import { getActiveProgressStore } from './history';
import type { Message } from './messages';
import { useProgress } from './progress/ProgressProvider';
import { sameProgressOwner } from './progress/types';

export function useStoredExam(examKey: string, certificationId: string) {
  const { store: progressStore } = useProgress();
  const store = progressStore ?? getActiveProgressStore();
  const examRefreshVersion = store?.getSnapshot().examRefreshVersion;
  const [draft, setDraft] = useState<ExamDraft>();
  const [error, setError] = useState<Message | ''>('');
  const [loading, setLoading] = useState(true);
  const currentDraft = useRef(draft);
  currentDraft.current = draft;
  const activeSince = useRef(performance.now());
  const submittedPending = useRef<object | null>(null);
  const loadSubmittedRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    let disposed = false;
    let requestVersion = 0;
    const owner = store?.getSnapshot().owner;
    const current = (request: number) =>
      !disposed &&
      request === requestVersion &&
      !!store &&
      !!owner &&
      store === getActiveProgressStore() &&
      sameProgressOwner(owner, store.getSnapshot().owner) &&
      examRefreshVersion === store.getSnapshot().examRefreshVersion;
    const refresh = async (mode: 'draft' | 'submitted' = 'draft') => {
      const request = ++requestVersion;
      setLoading(true);
      try {
        if (!store || !owner) throw new Error('Progress store is unavailable.');
        let next: ExamDraft | undefined;
        let historyReady = true;
        if (mode === 'submitted') {
          if (owner.kind !== 'member') throw new Error('Submitted results require an account.');
          const refreshed = await store.initialize();
          if (!current(request)) return;
          if (refreshed.state !== 'ready' || refreshed.error === 'load' || refreshed.refreshing)
            throw new Error('Learning history is not ready.');
          next = await store.loadSubmittedExam(certificationId);
          const submittedId = next?.id;
          historyReady =
            !submittedId || refreshed.attempts.some((attempt) => attempt.examId === submittedId);
        } else {
          next =
            owner.kind === 'member'
              ? await store.loadExam(certificationId)
              : store.readGuestExam(examKey);
        }
        if (!current(request)) return;
        if (!historyReady) throw new Error('Submitted exam history is not ready.');
        if (
          currentDraft.current?.id !== next?.id ||
          currentDraft.current?.position !== next?.position ||
          currentDraft.current?.revision !== next?.revision
        )
          activeSince.current = performance.now();
        setDraft(next);
        setError('');
        setLoading(false);
      } catch {
        if (current(request)) {
          setError('examLoadFailed');
          setLoading(false);
        }
      }
    };
    loadSubmittedRef.current = async () => {
      if (submittedPending.current) return;
      const token = {};
      submittedPending.current = token;
      try {
        await refresh('submitted');
      } finally {
        if (submittedPending.current === token) submittedPending.current = null;
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === examKey || event.key === null) void refresh();
    };
    void refresh();
    window.addEventListener('storage', onStorage);
    return () => {
      disposed = true;
      requestVersion += 1;
      submittedPending.current = null;
      loadSubmittedRef.current = async () => {};
      window.removeEventListener('storage', onStorage);
    };
  }, [certificationId, examKey, examRefreshVersion, store]);
  const reload = () => {
    if (!store || store !== getActiveProgressStore()) return;
    setLoading(true);
    store.notifyExamSessionsChanged();
  };
  const loadSubmittedExam = () => loadSubmittedRef.current();
  return { draft, setDraft, error, setError, activeSince, loading, reload, loadSubmittedExam };
}
