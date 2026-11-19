import { useEffect, useState } from 'react';
import type { Attempt } from '../attempts';
import { readHistory } from '../history';

export function useFundamentalsHistory() {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyError, setHistoryError] = useState(false);

  useEffect(() => {
    try {
      setAttempts(readHistory());
    } catch {
      setHistoryError(true);
    } finally {
      setHistoryLoaded(true);
    }
  }, []);

  return { attempts, historyError, historyLoaded, setAttempts };
}
