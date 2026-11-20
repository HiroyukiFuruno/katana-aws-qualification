import { useEffect, useState } from 'react';
import type { Attempt } from '../attempts';
import { getActiveProgressStore, historyKey, readHistory } from '../history';

export function useLearningHistory() {
  const store = getActiveProgressStore();
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const [resetVersion, setResetVersion] = useState(0);
  useEffect(() => {
    function refresh() {
      try {
        setAttempts(readHistory(store));
        setHistoryError((store?.getSnapshot().corruptRows ?? 0) > 0);
      } catch {
        setHistoryError(true);
      } finally {
        setHistoryLoaded(true);
      }
    }
    function fromStorage(event: StorageEvent) {
      if (store?.getSnapshot().owner.kind === 'member') return;
      if (event.key !== historyKey && event.key !== null) return;
      if (store) void store.initialize();
      else refresh();
      if (event.newValue === null) setResetVersion((value) => value + 1);
    }
    refresh();
    const unsubscribe = store?.subscribe(refresh);
    window.addEventListener('storage', fromStorage);
    return () => {
      unsubscribe?.();
      window.removeEventListener('storage', fromStorage);
    };
  }, [store]);
  return { attempts, setAttempts, historyLoaded, historyError, resetVersion };
}
