import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createLessonAssets } from '../fundamentals/delivery/assets';
import { lessonOutboxKey } from '../fundamentals/state/outboxCodec';
import { getActiveProgressStore } from '../history';
import { withHistoryLock } from '../historyLock';
import { guestLessonPrefix, historyKey } from '../learningStorage';
import { usePreferences } from '../preferences';
import { canPersistGuestProgress } from '../progress/guest';
import { useProgress } from '../progress/ProgressProvider';
import { createQuestionResolver } from '../progress/questionCatalog';
import type { ProgressStore } from '../progress/storeTypes';
import { dashboardDefaults } from './preferences';
import type { DashboardPreferences } from './preferenceTypes';
import { createDashboardServices } from './services';
import { DashboardView } from './ui/DashboardView';
import { useDashboardData } from './useDashboardData';
import { useDashboardSettings } from './useDashboardSettings';
import type { DashboardViewProps } from './viewTypes';
import { applyDashboardWidgetDraft } from './widgetDraft';

export function DashboardReady({
  store,
  storageControl,
}: {
  store: ProgressStore;
  storageControl?: DashboardViewProps['storageControl'];
}) {
  const progress = useProgress();
  const { locale, t } = usePreferences();
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [assets] = useState(createLessonAssets);
  const [resolve] = useState(createQuestionResolver);
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => {
    const update = () => {
      if (getActiveProgressStore() === store) setRevision((value) => value + 1);
    };
    if (store.getSnapshot().owner.kind === 'guest')
      void withHistoryLock(() => store.initialize()).then(update, update);
    else update();
  }, [store]);
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (
        event.key === null ||
        (snapshot.owner.kind === 'guest'
          ? event.key === historyKey || event.key?.startsWith(guestLessonPrefix)
          : event.key === lessonOutboxKey(snapshot.owner.userId))
      )
        retry();
    };
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, [snapshot.owner, retry]);
  const [initial] = useState(() => dashboardDefaults(Intl.DateTimeFormat().resolvedOptions().timeZone));
  const [applied, setApplied] = useState<{ preferences: DashboardPreferences; asOf: number } | null>(
    null,
  );
  const onApplied = useCallback(
    (preferences: DashboardPreferences) => setApplied({ preferences, asOf: Date.now() }),
    [],
  );
  const access = useRef(progress.migrationAccess());
  access.current = progress.migrationAccess();
  const session = useMemo(
    () => ({
      revision,
      attempts: snapshot.attempts,
      examVersion: snapshot.examRefreshVersion,
      asOf: Date.now(),
      services: createDashboardServices({
        store,
        client: access.current?.client ?? null,
        isCurrent: () =>
          getActiveProgressStore() === store &&
          (access.current?.isCurrent() ?? canPersistGuestProgress(localStorage)),
        storage: localStorage,
        assets,
        resolve,
        locale,
      }),
    }),
    [store, assets, resolve, locale, revision, snapshot.attempts, snapshot.examRefreshVersion],
  );
  const generation = useSyncExternalStore(session.services.subscribe, session.services.getSnapshot);
  const settings = useDashboardSettings(
    session.services,
    initial.filters.timezone,
    onApplied,
    snapshot.owner.kind === 'guest',
  );
  const cycle = useMemo(
    () => ({
      services: session.services,
      generation,
      preferences: applied?.preferences ?? initial,
      asOf: Math.max(applied?.asOf ?? 0, session.asOf),
      enabled: settings.status === 'ready' && applied !== null,
    }),
    [session, applied, initial, settings.status, generation],
  );
  const data = useDashboardData(cycle, retry);
  if (settings.status !== 'ready')
    return (
      <main id="main" className="shell account-page">
        <h1>{t('accountDashboard')}</h1>
        {storageControl}
        <p role={settings.status === 'error' ? 'alert' : 'status'}>
          {t(settings.status === 'error' ? 'dashboardError' : 'accountLoading')}
        </p>
        {settings.status === 'error' && (
          <button type="button" onClick={settings.reload}>
            {t('progressRetry')}
          </button>
        )}
      </main>
    );
  return (
    <DashboardView
      milestoneApi={session.services.milestones}
      storageControl={storageControl}
      owner={snapshot.owner.kind}
      consented
      preferences={settings.draft}
      dirty={settings.dirty}
      saving={settings.saving}
      saveState={settings.saveState}
      pendingLearning={
        snapshot.error !== undefined || snapshot.refreshing === true || data.syncStatus.pending
      }
      syncUnreadable={data.syncStatus.unreadable}
      data={data.data}
      lessons={data.lessons}
      onPreferences={(draft) => {
        settings.change(draft);
        setApplied((current) => applyDashboardWidgetDraft(current, draft));
      }}
      onApply={settings.apply}
      onSave={() => {
        settings.apply();
        settings.save();
      }}
      onReloadSettings={settings.reload}
      onReset={settings.reset}
      onConsent={() => {}}
      onRefresh={retry}
    />
  );
}
