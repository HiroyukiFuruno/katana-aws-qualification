import { useEffect, useRef, useState } from 'react';
import { usePreferences } from '../../preferences';
import { guestProgressConsentKey } from '../../progress/guest';
import { ProgressGate } from '../../progress/ProgressGate';
import type { DeliveryIndexAsset } from '../delivery/artifactTypes';
import { navigateLesson } from '../delivery/useLessonLocation';
import { guestLessonPrefix } from '../state/guestStorage';
import type { LessonMigrationAccess } from '../state/importTypes';
import type { LessonSummary } from '../state/memberTypes';
import type { LessonServices } from '../state/services';
import { LessonCatalog } from './LessonCatalog';
import { LessonMigrationList } from './LessonMigrationList';

type LessonCatalogPageProps = {
  services: LessonServices;
  migrationAccess?: () => LessonMigrationAccess | null;
};

export function LessonCatalogPage({ services, migrationAccess }: LessonCatalogPageProps) {
  const { t } = usePreferences();
  const [index, setIndex] = useState<DeliveryIndexAsset>();
  const [summaries, setSummaries] = useState<LessonSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [summaryFailed, setSummaryFailed] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const requestVersion = useRef(0);
  useEffect(() => {
    let current = true;
    const request = reloadToken + requestVersion.current + 1;
    requestVersion.current = request;
    setLoading(true);
    setFailed(false);
    setSummaryFailed(false);
    setIndex(undefined);
    void services.assets
      .index()
      .then(async (nextIndex) => {
        if (current && requestVersion.current === request) setIndex(nextIndex);
        try {
          const nextSummaries = await services.summaries();
          if (current && requestVersion.current === request) setSummaries(nextSummaries);
        } catch {
          if (current && requestVersion.current === request) setSummaryFailed(true);
        }
      })
      .catch(() => {
        if (current && requestVersion.current === request) setFailed(true);
      })
      .finally(() => {
        if (current && requestVersion.current === request) setLoading(false);
      });
    const refresh = () => setReloadToken((value) => value + 1);
    const unsubscribe = services.guest?.subscribe(refresh);
    const onStorage = (event: StorageEvent) => {
      if (event.key === null) {
        services.guest?.clearMemory();
      } else if (event.key.startsWith(guestLessonPrefix)) {
        if (event.newValue === null) services.guest?.clearMemory(event.key);
        else refresh();
      } else if (event.key === guestProgressConsentKey) {
        refresh();
      } else if (event.key.startsWith('katana.fundamentals-outbox.v1.') && event.newValue === null) {
        refresh();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      current = false;
      unsubscribe?.();
      window.removeEventListener('storage', onStorage);
    };
  }, [services, reloadToken]);
  return (
    <ProgressGate>
      {migrationAccess && (
        <LessonMigrationList
          services={services}
          access={migrationAccess}
          onImported={() => setReloadToken((value) => value + 1)}
        />
      )}
      {failed || !index ? (
        <main id="main" className="shell fundamentals-page">
          {loading ? (
            <p role="status">{t('fundamentalsLoading')}</p>
          ) : (
            <>
              <p role="alert">{t('fundamentalsLoadError')}</p>
              <button type="button" onClick={() => setReloadToken((value) => value + 1)}>
                {t('fundamentalsReload')}
              </button>
            </>
          )}
        </main>
      ) : (
        <LessonCatalog
          index={index}
          summaries={summaries}
          loading={loading}
          error={summaryFailed ? t('fundamentalsHistoryUnavailable') : undefined}
          summaryUnavailable={summaryFailed}
          pendingUnitIds={index.units
            .filter((unit) => services.outbox?.hasPending(unit))
            .map((unit) => unit.unitId)}
          onRetry={() => setReloadToken((value) => value + 1)}
          onNavigate={navigateLesson}
        />
      )}
    </ProgressGate>
  );
}
