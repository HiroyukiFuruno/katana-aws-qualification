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
    const refresh = async () => {
      const request = ++requestVersion;
      setLoading(true);
      try {
        if (!store || !owner) throw new Error('Progress store is unavailable.');
        const next =
          owner.kind === 'member' ? await store.loadExam(certificationId) : store.readGuestExam(examKey);
        if (!current(request)) return;
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
    const onStorage = (event: StorageEvent) => {
      if (event.key === examKey || event.key === null) void refresh();
    };
    void refresh();
    window.addEventListener('storage', onStorage);
    return () => {
      disposed = true;
      window.removeEventListener('storage', onStorage);
    };
  }, [certificationId, examKey, examRefreshVersion, store]);
  const reload = () => {
    if (!store || store !== getActiveProgressStore()) return;
    setLoading(true);
    store.notifyExamSessionsChanged();
  };
  return { draft, setDraft, error, setError, activeSince, loading, reload };
}
