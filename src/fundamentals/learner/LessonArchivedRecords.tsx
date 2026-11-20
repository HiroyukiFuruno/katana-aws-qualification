import { useEffect, useState } from 'react';
import { usePreferences } from '../../preferences';
import { lessonPath } from '../delivery/navigation';
import { navigateLesson } from '../delivery/useLessonLocation';
import type { ArchivedLessonRecord } from '../state/archivedRecords';
import type { LessonServices } from '../state/services';

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
    records: ArchivedLessonRecord[];
    request: number;
  }>();
  const [failed, setFailed] = useState<{ services: LessonServices; request: number }>();
  const [retry, setRetry] = useState(0);
  const request = reloadToken + retry;
  useEffect(() => {
    let current = true;
    setFailed(undefined);
    void services
      .archivedRecords()
      .then((records) => {
        if (current) setLoaded({ services, records, request });
      })
      .catch(() => {
        if (current) setFailed({ services, request });
      });
    return () => {
      current = false;
    };
  }, [services, request]);
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
        {records.map(({ unit, summary, pending, publishedOn }) => {
          const href = lessonPath({
            locale,
            unitId: unit.unitId,
            stage: 'resume',
            contentVersion: unit.contentVersion,
          });
          return (
            <li key={`${unit.unitId}:${unit.contentVersion}`}>
              <strong>{unit.title}</strong>{' '}
              {publishedOn && (
                <time dateTime={publishedOn}>
                  {new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(
                    new Date(`${publishedOn}T00:00:00Z`),
                  )}
                </time>
              )}
              {pending && <p role="status">{t('lessonPendingSave')}</p>}
              {summary.passedAt && <p>{t('lessonPassed')}</p>}
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
                {summary.latestScore !== null && !summary.activeFinalSessionId
                  ? t('results')
                  : t('fundamentalsResume')}
              </a>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
