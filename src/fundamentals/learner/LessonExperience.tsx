import { useEffect, useState } from 'react';
import { localePath } from '../../locales';
import { usePreferences } from '../../preferences';
import { lessonPath, lessonRouteAt } from '../delivery/navigation';
import { stepHref } from '../delivery/planNavigation';
import { navigateLesson, useLessonLocation } from '../delivery/useLessonLocation';
import { useLessonServices } from '../state/useLessonServices';
import { LessonCatalogPage } from './LessonCatalogPage';
import { LessonUnit } from './LessonUnit';

export function LessonExperience() {
  const url = useLessonLocation();
  const { locale, t } = usePreferences();
  const { services, status, cleanupError, retry, migrationAccess } = useLessonServices();
  const [legacyError, setLegacyError] = useState<unknown>();
  const legacyQuery =
    url.pathname === localePath(locale, 'study/fundamentals') &&
    url.searchParams.getAll('unit').length === 1 &&
    url.searchParams.getAll('review').length <= 1 &&
    [...url.searchParams.keys()].every((key) => key === 'unit' || key === 'review');
  const legacyUnit = legacyQuery ? url.searchParams.get('unit') : null;
  const review = url.searchParams.get('review') === '1';
  useEffect(() => {
    let current = true;
    if (!services || !legacyUnit) return;
    void services.assets
      .unit(legacyUnit)
      .then((asset) => {
        if (!current) return;
        const first = asset.steps[0];
        if (!first) throw new Error('A lesson reading slide is missing.');
        navigateLesson(
          review
            ? stepHref(locale, first, asset)
            : lessonPath({ locale, unitId: legacyUnit, stage: 'resume' }),
          true,
        );
      })
      .catch((cause: unknown) => {
        if (current) setLegacyError(cause);
      });
    return () => {
      current = false;
    };
  }, [services, legacyUnit, review, locale]);
  if (cleanupError || legacyError || status === 'error') {
    return (
      <main id="main" className="shell">
        <p role="alert">{t('fundamentalsLoadError')}</p>
        <button type="button" onClick={retry}>
          {t('fundamentalsReload')}
        </button>
        <a href={localePath(locale, 'study/fundamentals')}>{t('fundamentalsBackToCatalog')}</a>
      </main>
    );
  }
  if (!services || status !== 'ready' || legacyUnit) {
    return (
      <main id="main" className="shell">
        <p role="status">{t('fundamentalsLoading')}</p>
      </main>
    );
  }
  const route = lessonRouteAt(url.pathname, url.search);
  if (!route && (url.pathname !== localePath(locale, 'study/fundamentals') || url.search))
    return (
      <main id="main" className="shell">
        <p role="alert">{t('fundamentalsLoadError')}</p>
        <a href={localePath(locale, 'study/fundamentals')}>{t('fundamentalsBackToCatalog')}</a>
      </main>
    );
  return route ? (
    <LessonUnit
      key={`${route.unitId}:${route.contentVersion ?? 'current'}`}
      services={services}
      route={route}
    />
  ) : (
    <LessonCatalogPage services={services} migrationAccess={migrationAccess} />
  );
}
