import { useEffect, useState } from 'react';
import { usePreferences } from '../../preferences';
import type { DeliveryIndexAsset } from '../delivery/artifactTypes';
import { lessonPath } from '../delivery/navigation';
import { navigateLesson } from '../delivery/useLessonLocation';
import type { ArchivedLessonRecord } from '../state/archivedRecords';
import { isLessonConflict } from '../state/isLessonConflict';
import type { LessonServices } from '../state/services';

type ArchivedRecordView = {
  currentUnit?: DeliveryIndexAsset['units'][number];
  record: ArchivedLessonRecord;
};

export function LessonArchivedRecords({
  services,
  reloadToken,
}: {
  services: LessonServices;
  reloadToken: number;
}) {
  const { t, locale } = usePreferences();
  const [loaded, setLoaded] = useState<{
    services: LessonServices;
    records: ArchivedRecordView[];
    request: number;
  }>();
  const [failed, setFailed] = useState<{ services: LessonServices; request: number }>();
  const [sync, setSync] = useState<{
    services: LessonServices;
    key: string;
    state: 'saving' | 'failed' | 'conflict';
  }>();
  const [retry, setRetry] = useState(0);
  const request = reloadToken + retry;
  useEffect(() => {
    let current = true;
    setFailed(undefined);
    void services
      .archivedRecords(locale)
      .then(async (records) => {
        const index = await services.assets.index(locale);
        const currentUnits = new Map(index.units.map((unit) => [unit.unitId, unit]));
        if (current)
          setLoaded({
            services,
            records: records.map((record) => ({
              record,
              currentUnit: currentUnits.get(record.unit.unitId),
            })),
            request,
          });
      })
      .catch(() => {
        if (current) setFailed({ services, request });
      });
    return () => {
      current = false;
    };
  }, [services, locale, request]);
  if (failed?.services === services && failed.request === request)
    return (
      <section className="shell notice" aria-label={t('fundamentalsArchivedTitle')}>
        <p role="alert">{t('fundamentalsHistoryUnavailable')}</p>
        <button type="button" onClick={() => setRetry((value) => value + 1)}>
          {t('fundamentalsReload')}
        </button>
      </section>
    );
  const records = loaded?.services === services && loaded.request === request ? loaded.records : [];
  if (!records.length) return null;
  return (
    <details className="shell card lesson-archived-records">
      <summary>
        {t('fundamentalsArchivedTitle')} · {records.length}
      </summary>
      <p>{t('fundamentalsArchivedDescription')}</p>
      <ul>
        {records.map(({ record: { unit, summary, pending }, currentUnit }) => {
          const key = `${unit.unitId}:${unit.contentVersion}`;
          const state = sync?.services === services && sync.key === key ? sync.state : undefined;
          const conflict = state === 'conflict';
          const href =
            currentUnit?.state === 'published'
              ? lessonPath({ locale, unitId: currentUnit.unitId, stage: 'resume' })
              : undefined;
          return (
            <li key={key}>
              <strong>{unit.title}</strong>
              {pending && (
                <>
                  <p role="status">{t('fundamentalsArchivedPending')}</p>
                  {(state === 'failed' || conflict) && (
                    <p role="alert">
                      {t(conflict ? 'progressStorageConflictDescription' : 'studySaveFailed')}
                    </p>
                  )}
                  <button
                    type="button"
                    disabled={sync?.services === services && sync.state === 'saving'}
                    onClick={() => {
                      setSync({ services, key, state: 'saving' });
                      const update = conflict
                        ? services.reloadArchivedRecord(unit)
                        : services.retryArchivedRecord(unit);
                      void update.then(
                        () => {
                          setSync(undefined);
                          setRetry((value) => value + 1);
                        },
                        (error: unknown) =>
                          setSync({
                            services,
                            key,
                            state: isLessonConflict(error) ? 'conflict' : 'failed',
                          }),
                      );
                    }}
                  >
                    {t(conflict ? 'examReloadSaved' : 'lessonRetry')}
                  </button>
                </>
              )}
              {summary.passedAt && <p>{t('lessonPassed')}</p>}
              {summary.latestScore !== null && (
                <p>
                  {t('fundamentalsScore')}: {summary.latestScore} / 12
                  {summary.requiredScore !== null &&
                    ` (${summary.requiredScore} ${t('fundamentalsResultRequired')})`}
                </p>
              )}
              <p>
                {t('fundamentalsSteps')}: {summary.completedSlides} / {summary.totalSlides}
              </p>
              <p>
                {t('fundamentalsCheckpoints')}: {summary.completedCheckpoints} /{' '}
                {summary.totalCheckpoints}
              </p>
              {summary.activeFinalSessionId && <p>{t('fundamentalsTakingFinal')}</p>}
              {href && (
                <a
                  href={href}
                  onClick={(event) => {
                    if (
                      event.button !== 0 ||
                      event.metaKey ||
                      event.ctrlKey ||
                      event.shiftKey ||
                      event.altKey
                    )
                      return;
                    event.preventDefault();
                    navigateLesson(href);
                  }}
                >
                  {t('fundamentalsResume')}
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </details>
  );
}
