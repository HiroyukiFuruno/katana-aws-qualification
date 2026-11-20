import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { usePreferences } from '../preferences';
import {
  canPersistGuestProgress,
  guestProgressConsentKey,
  setGuestProgressConsent,
} from '../progress/guest';
import { ProgressConsent } from '../progress/ProgressConsent';
import type { ProgressStore } from '../progress/storeTypes';
import { DashboardReady } from './DashboardReady';
import { dashboardDefaults } from './preferences';
import { DashboardView } from './ui/DashboardView';

export function DashboardOwner({ store }: { store: ProgressStore }) {
  const { locale, t } = usePreferences();
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const guest = snapshot.owner.kind === 'guest';
  const [consented, setConsented] = useState(() => !guest || canPersistGuestProgress(localStorage));
  const [failed, setFailed] = useState(false);
  const refreshConsent = useCallback(() => {
    const allowed = !guest || canPersistGuestProgress(localStorage);
    setConsented(allowed);
    if (guest && allowed) void store.retryPending().catch(() => setFailed(true));
  }, [guest, store]);
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key === null || event.key === guestProgressConsentKey) refreshConsent();
    };
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, [refreshConsent]);
  const consent = () => {
    if (!setGuestProgressConsent(localStorage, true)) {
      setFailed(true);
      return;
    }
    setFailed(false);
    refreshConsent();
  };
  return (
    <>
      {failed && (
        <p className="shell" role="alert">
          {t('progressStorageFailed')}
        </p>
      )}
      {consented ? (
        <DashboardReady
          key={locale}
          store={store}
          storageControl={
            guest ? (
              <details className="dashboard-storage-control">
                <summary>{t('progressStorageTitle')}</summary>
                <ProgressConsent onChange={refreshConsent} compact />
              </details>
            ) : undefined
          }
        />
      ) : (
        <DashboardView
          storageControl={
            <details className="dashboard-storage-control" open>
              <summary>{t('progressStorageTitle')}</summary>
              <ProgressConsent onChange={refreshConsent} compact />
            </details>
          }
          owner="guest"
          consented={false}
          preferences={dashboardDefaults(Intl.DateTimeFormat().resolvedOptions().timeZone)}
          dirty={false}
          saving={false}
          saveState="idle"
          pendingLearning={false}
          data={new Map()}
          lessons={{ status: 'loading', items: [] }}
          onPreferences={() => {}}
          onApply={() => {}}
          onSave={() => {}}
          onReloadSettings={() => {}}
          onReset={() => {}}
          onConsent={consent}
          onRefresh={refreshConsent}
        />
      )}
    </>
  );
}
