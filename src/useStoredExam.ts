import { useEffect, useRef, useState } from 'react';
import { readExam, type ExamDraft } from './exam';
import type { Message } from './messages';

export function useStoredExam(examKey: string) {
  const [draft, setDraft] = useState<ExamDraft>();
  const [error, setError] = useState<Message | ''>('');
  const activeSince = useRef(Date.now());
  useEffect(() => {
    const refresh = () => {
      try {
        setDraft(readExam(examKey));
        activeSince.current = Date.now();
      } catch {
        setError('examLoadFailed');
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === examKey || event.key === null) refresh();
    };
    refresh();
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [examKey]);
  return { draft, setDraft, error, setError, activeSince };
}
