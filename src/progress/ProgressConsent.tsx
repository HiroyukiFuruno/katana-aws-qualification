import { useEffect, useState } from 'react';
import { usePreferences } from '../preferences';
import { canPersistGuestProgress, guestProgressConsentKey, setGuestProgressConsent } from './guest';

function readConsent() {
  try {
    return canPersistGuestProgress(localStorage);
  } catch {
    return false;
  }
}

export function ProgressConsent({
  onChange,
  compact = false,
}: {
  onChange: () => void;
  compact?: boolean;
}) {
  const { t } = usePreferences();
  const [consent, setConsent] = useState(readConsent);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const refresh = (event: StorageEvent) => {
      if (event.key === guestProgressConsentKey || event.key === null) setConsent(readConsent());
    };
    window.addEventListener('storage', refresh);
    return () => window.removeEventListener('storage', refresh);
  }, []);

  function update(granted: boolean) {
    setFailed(false);
    try {
      if (!setGuestProgressConsent(localStorage, granted)) throw new Error('Storage unavailable');
      setConsent(granted);
      onChange();
    } catch {
      setFailed(true);
    }
  }

  return (
    <section className="card layout-stack" aria-labelledby="progress-storage-title">
      {compact ? (
        <p id="progress-storage-title">
          <strong>{t('progressStorageTitle')}</strong>
        </p>
      ) : (
        <h2 id="progress-storage-title">{t('progressStorageTitle')}</h2>
      )}
      <p>{t('progressStorageDescription')}</p>
      <label className="progress-storage-choice">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => update(event.currentTarget.checked)}
        />
        <span>{t('progressStorageAllow')}</span>
      </label>
      {!consent && <p>{t('progressTransient')}</p>}
      {failed && <p role="alert">{t('progressStorageFailed')}</p>}
    </section>
  );
}
