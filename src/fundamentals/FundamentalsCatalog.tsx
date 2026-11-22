import type { Attempt } from '../attempts';
import { usePreferences } from '../preferences';
import { questionKey } from '../questions';
import { moduleLabels } from './moduleLabels';
import type { FundamentalsContent } from './types';

export { latestFor } from './session';

type UnitStatus = 'notStarted' | 'inProgress' | 'completed' | 'review';

export function statusFor(
  unit: FundamentalsContent['units'][number],
  latest: Map<string, Attempt>,
): UnitStatus {
  const attempts = unit.questions.map((question) => latest.get(questionKey(question)));
  if (!attempts.some(Boolean)) return 'notStarted';
  if (attempts.some((attempt) => attempt && !attempt.isCorrect)) return 'review';
  return attempts.every(Boolean) ? 'completed' : 'inProgress';
}

export function FundamentalsCatalog({
  content,
  latest,
  historyUnavailable,
  openUnit,
}: {
  content: FundamentalsContent;
  latest: Map<string, Attempt>;
  historyUnavailable: boolean;
  openUnit: (id: string, asReview?: boolean) => void;
}) {
  const { t } = usePreferences();
  return (
    <main id="main" className="shell fundamentals-page">
      <div className="intro">
        <p className="eyebrow">{t('fundamentalsCatalogEyebrow')}</p>
        <h1>{t('fundamentalsCatalogTitle')}</h1>
        <p>{t('fundamentalsCatalogIntro')}</p>
        {historyUnavailable && (
          <p className="notice" role="alert">
            {t('fundamentalsHistoryUnavailable')}
          </p>
        )}
      </div>
      <div className="fundamentals-catalog">
        {content.catalog.map((item) => {
          const available = item.state === 'published';
          const unit = content.units.find((candidate) => candidate.id === item.id);
          const status = unit && !historyUnavailable ? statusFor(unit, latest) : undefined;
          return (
            <article className="card fundamentals-unit-card" key={item.id}>
              <p className="eyebrow">
                {item.order} · {t(moduleLabels[item.parent])}
              </p>
              <h2>{item.title}</h2>
              <p>{item.objective}</p>
              {available && unit ? (
                <>
                  <button className="primary" type="button" onClick={() => openUnit(item.id)}>
                    {historyUnavailable || status === 'notStarted'
                      ? t('fundamentalsStart')
                      : status === 'completed'
                        ? t('fundamentalsRestart')
                        : t('fundamentalsResume')}
                  </button>
                  {status === 'review' && (
                    <button type="button" onClick={() => openUnit(item.id, true)}>
                      {t('fundamentalsReviewMistakes')}
                    </button>
                  )}
                </>
              ) : (
                <p className="fundamentals-planned">{t('coursePending')}</p>
              )}
              {available && status && (
                <p className="fundamentals-status">
                  {t('fundamentalsStatus')}{' '}
                  {status === 'notStarted'
                    ? t('fundamentalsNotStarted')
                    : status === 'inProgress'
                      ? t('fundamentalsInProgress')
                      : status === 'completed'
                        ? t('fundamentalsCompleted')
                        : t('fundamentalsReviewNeeded')}
                </p>
              )}
            </article>
          );
        })}
      </div>
    </main>
  );
}
