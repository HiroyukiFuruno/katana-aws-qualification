import { useEffect, useRef, useState } from 'react';

export function useSavedLessonReload(
  discard: () => Promise<void>,
  reload: () => Promise<void>,
  clear: () => void,
) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const mounted = useRef(true);
  const locked = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const retry = async () => {
    if (locked.current || !mounted.current) return;
    locked.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await discard();
      await reload();
      if (mounted.current) clear();
    } catch (cause) {
      if (mounted.current) setError(cause);
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  return { busy, error, retry };
}
