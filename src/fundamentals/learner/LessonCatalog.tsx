import { type MouseEvent, useState } from 'react';
import { usePreferences } from '../../preferences';
import type { DeliveryIndexAsset } from '../delivery/artifactTypes';
import { lessonPath } from '../delivery/navigation';
import type { LessonSummary } from '../state/memberTypes';
import { type CatalogStatus, LessonCatalogCard } from './LessonCatalogCard';
import './lesson-catalog.css';

type LessonCatalogProps = {
  index: DeliveryIndexAsset;
  summaries: readonly LessonSummary[];
  loading?: boolean;
  error?: string;
  summaryUnavailable?: boolean;
  pendingUnitIds?: readonly string[];
  onRetry?: () => void | Promise<void>;
  onNavigate: (href: string) => void | Promise<void>;
};

export function statusOf(summary: LessonSummary | undefined): CatalogStatus {
  if (!summary || (summary.completedSlides === 0 && summary.completedCheckpoints === 0))
    return 'notStarted';
  if (summary.passedAt) return 'passed';
  if (summary.activeFinalSessionId) return 'takingFinal';
  if (
    summary.latestScore !== null &&
    summary.requiredScore !== null &&
    summary.latestScore < summary.requiredScore
  )
    return 'review';
  return 'inProgress';
}

export function LessonCatalog({
  index,
  summaries,
  loading = false,
  error,
  summaryUnavailable = false,
  pendingUnitIds = [],
  onRetry,
  onNavigate,
}: LessonCatalogProps) {
  const { locale, t } = usePreferences();
  const [actionError, setActionError] = useState<{ cause: unknown }>();
  const byUnit = new Map(summaries.map((summary) => [summary.unitId, summary]));
  const navigate = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    void Promise.resolve()
      .then(() => onNavigate(href))
      .catch((cause: unknown) => setActionError({ cause }));
  };
  return (
    <main id="main" className="shell fundamentals-page lesson-catalog-page">
      <div className="intro">
        <p className="eyebrow">{t('fundamentalsCatalogEyebrow')}</p>
        <h1>{t('fundamentalsCatalogTitle')}</h1>
        <p>{t('fundamentalsCatalogIntro')}</p>
      </div>
      {loading && <p role="status">{t('fundamentalsLoading')}</p>}
      {error && (
        <div className="notice" role="alert">
          <p>{error}</p>
          {onRetry && (
            <button type="button" onClick={() => void onRetry()}>
              {t('fundamentalsReload')}
            </button>
          )}
        </div>
      )}
      {actionError && (
        <p className="notice" role="alert">
          {t('fundamentalsActionFailed')}
        </p>
      )}
      <div className="lesson-catalog-list">
        {index.units.map((unit) => {
          const summary = byUnit.get(unit.unitId);
          const status = statusOf(summary);
          const href = lessonPath({ locale, unitId: unit.unitId, stage: 'resume' });
          return (
            <LessonCatalogCard
              key={unit.unitId}
              index={index}
              unit={unit}
              summary={summary}
              summaryUnavailable={summaryUnavailable}
              pending={pendingUnitIds.includes(unit.unitId)}
              status={status}
              href={href}
              action={status === 'notStarted' ? t('fundamentalsStart') : t('fundamentalsResume')}
              onClick={(event) => navigate(event, href)}
            />
          );
        })}
      </div>
    </main>
  );
}
