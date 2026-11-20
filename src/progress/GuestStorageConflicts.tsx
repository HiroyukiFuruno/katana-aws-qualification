import { useEffect, useId, useRef, useState } from 'react';
import { usePreferences } from '../preferences';
import type { ProgressStore } from './storeTypes';

export function GuestStorageConflicts({ store }: { store: ProgressStore | null }) {
  const { t } = usePreferences();
  const headingId = useId();
  const [, setVersion] = useState(0);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const resolving = useRef(false);
  const conflictStore = store?.getSnapshot().owner.kind === 'guest' ? store : null;
  const conflicts = conflictStore?.guestStorageConflicts() ?? [];

  useEffect(() => {
    if (!conflictStore) return;
    return conflictStore.subscribe(() => setVersion((current) => current + 1));
  }, [conflictStore]);

  if (!conflictStore || conflicts.length === 0) return null;
  const activeStore = conflictStore;

  async function resolve(
    conflict: { key: string; kind: 'profile' | 'exam' },
    choice: 'stored' | 'pending',
  ) {
    if (resolving.current) return;
    resolving.current = true;
    setWorking(conflict.key);
    setError(false);
    try {
      await activeStore.resolveGuestStorageConflict(conflict.key, choice);
      setVersion((current) => current + 1);
    } catch {
      setError(true);
    } finally {
      resolving.current = false;
      setWorking(null);
    }
  }

  return (
    <section className="card layout-stack" aria-labelledby={headingId}>
      <h2 id={headingId}>{t('progressStorageConflictTitle')}</h2>
      <p>{t('progressStorageConflictDescription')}</p>
      {conflicts.map((conflict) => (
        <div className="layout-stack" key={conflict.key}>
          <strong>
            {t(
              conflict.kind === 'profile'
                ? 'progressStorageConflictProfile'
                : 'progressStorageConflictExam',
            )}
          </strong>
          <p>{t('progressStorageConflictChoiceDescription')}</p>
          <div className="button-row">
            <button
              type="button"
              disabled={working !== null}
              onClick={() => void resolve(conflict, 'stored')}
            >
              {t('progressStorageConflictUseStored')}
            </button>
            <button
              type="button"
              disabled={working !== null}
              onClick={() => void resolve(conflict, 'pending')}
            >
              {t('progressStorageConflictUseCurrent')}
            </button>
          </div>
        </div>
      ))}
      {error && <p role="alert">{t('progressStorageConflictFailed')}</p>}
    </section>
  );
}
