import type { MouseEvent } from 'react';
import { usePreferences } from '../../preferences';
import type { DeliveryIndexAsset } from '../delivery/artifactTypes';
import { lessonDisplayText } from '../delivery/lessonReadingCopy';
import { moduleLabels } from '../moduleLabels';
import type { LessonSummary } from '../state/memberTypes';

export type CatalogStatus = 'notStarted' | 'inProgress' | 'takingFinal' | 'review' | 'passed';

export function LessonCatalogCard({
  index,
  unit,
  summary,
  summaryUnavailable = false,
  pending = false,
  status,
  href,
  action,
  onClick,
}: {
  index: DeliveryIndexAsset;
  unit: DeliveryIndexAsset['units'][number];
  summary?: LessonSummary;
  summaryUnavailable?: boolean;
  pending?: boolean;
  status: CatalogStatus;
  href: string;
  action: string;
  onClick: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const { t, locale } = usePreferences();
  return (
    <article className="card lesson-catalog-card">
      <p className="eyebrow">
        {unit.order} · {moduleLabels[unit.parent] ? t(moduleLabels[unit.parent]) : unit.parent}
      </p>
      <h2>{unit.title}</h2>
      {pending && <p role="status">{t('lessonPendingSave')}</p>}
      <p className="lesson-catalog-objective">
        {lessonDisplayText(unit.objective, locale, unit.unitId)}
      </p>
      <dl className="lesson-catalog-facts">
        <div>
          <dt>{t('fundamentalsMinutes')}</dt>
          <dd>{unit.minutes}</dd>
        </div>
        <div>
          <dt>{t('fundamentalsCheckpoints')}</dt>
          <dd>{unit.checkpointCount}</dd>
        </div>
      </dl>
      {unit.prerequisiteIds.length > 0 && (
        <p className="lesson-catalog-prerequisites">
          {t('fundamentalsPrerequisites')}:{' '}
          {unit.prerequisiteIds
            .map((id) => index.units.find((candidate) => candidate.unitId === id)?.title ?? id)
            .join(', ')}
        </p>
      )}
      {summaryUnavailable ? (
        <p className="lesson-catalog-status" role="status">
          {t('fundamentalsHistoryUnavailable')}
        </p>
      ) : (
        <p className={`lesson-catalog-status lesson-catalog-status-${status}`}>
          {t('fundamentalsStatus')}{' '}
          {status === 'notStarted'
            ? t('fundamentalsNotStarted')
            : status === 'inProgress'
              ? t('fundamentalsInProgress')
              : status === 'takingFinal'
                ? t('fundamentalsTakingFinal')
                : status === 'review'
                  ? t('lessonNotPassed')
                  : t('lessonPassed')}
        </p>
      )}
      {summary?.latestScore !== null && summary?.latestScore !== undefined && (
        <p>
          {t('fundamentalsScore')}: {summary.latestScore} / {unit.finalQuestionCount}
          {summary.requiredScore !== null &&
            ` (${summary.requiredScore} ${t('fundamentalsResultRequired')})`}
        </p>
      )}
      {summary?.passedAt &&
        summary.latestScore !== null &&
        summary.requiredScore !== null &&
        summary.latestScore < summary.requiredScore && (
          <p className="lesson-catalog-prior-pass">{t('fundamentalsResultPreviousPass')}</p>
        )}
      {unit.state === 'published' ? (
        <a className="primary lesson-catalog-action" href={href} onClick={onClick}>
          {action}
        </a>
      ) : (
        <p className="fundamentals-planned">{t('coursePending')}</p>
      )}
    </article>
  );
}
