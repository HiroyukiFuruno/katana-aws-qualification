import { useEffect, useRef, useState } from 'react';
import { readExam, type ExamDraft } from './exam';
import { getActiveProgressStore } from './history';
import type { Message } from './messages';
import { useProgress } from './progress/ProgressProvider';

export function useStoredExam(examKey: string, certificationId: string) {
  const { store: progressStore } = useProgress();
  const store = progressStore ?? getActiveProgressStore();
  const [draft, setDraft] = useState<ExamDraft>();
  const [error, setError] = useState<Message | ''>('');
  const activeSince = useRef(Date.now());
  useEffect(() => {
    const refresh = async () => {
      try {
        const next =
          store?.getSnapshot().owner.kind === 'member'
            ? await store.loadExam(certificationId)
            : readExam(examKey);
        setDraft(next);
        activeSince.current = Date.now();
      } catch {
        setError('examLoadFailed');
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === examKey || event.key === null) void refresh();
    };
    refresh();
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [certificationId, examKey, store]);
  return { draft, setDraft, error, setError, activeSince };
}
