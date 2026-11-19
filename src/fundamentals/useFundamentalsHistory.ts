import { useEffect, useState } from 'react';
import type { Attempt } from '../attempts';
import { historyKey, readHistory } from '../history';

export function useFundamentalsHistory() {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyError, setHistoryError] = useState(false);

  useEffect(() => {
    const refresh = () => {
      try {
        setAttempts(readHistory());
        setHistoryError(false);
      } catch {
        setHistoryError(true);
      } finally {
        setHistoryLoaded(true);
      }
    };
    const refreshFromStorage = (event: StorageEvent) => {
      if (event.key === historyKey || event.key === null) refresh();
    };
    refresh();
    window.addEventListener('storage', refreshFromStorage);
    return () => window.removeEventListener('storage', refreshFromStorage);
  }, []);

  return { attempts, historyError, historyLoaded, setAttempts };
}
