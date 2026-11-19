import { usePreferences } from '../preferences';
import type { FundamentalsUnit } from './types';

type Props = {
  unit: FundamentalsUnit;
  hasReview: boolean;
  hasUnanswered: boolean;
  onCatalog: () => void;
  onReview: () => void;
  onStudy: () => void;
  onNext?: () => void;
};

export function FundamentalsResults({
  unit,
  hasReview,
  hasUnanswered,
  onCatalog,
  onReview,
  onStudy,
  onNext,
}: Props) {
  const { t } = usePreferences();
  return (
    <section className="card fundamentals-lesson" aria-labelledby="fundamentals-results">
      <h2 id="fundamentals-results">{t('fundamentalsResultsTitle', { title: unit.title })}</h2>
      <p>{t('fundamentalsResultsIntro')}</p>
      {hasUnanswered && <p>{t('fundamentalsUnanswered')}</p>}
      {hasReview && <p>{t('fundamentalsReviewNeeded')}</p>}
      <div className="answer-footer">
        {hasUnanswered && (
          <button className="primary" type="button" onClick={onStudy}>
            {t('fundamentalsContinueUnanswered')}
          </button>
        )}
        {hasReview && (
          <button type="button" onClick={onReview}>
            {t('review')}
          </button>
        )}
        {onNext && (
          <button type="button" onClick={onNext}>
            {t('fundamentalsNextUnit')}
          </button>
        )}
        <button type="button" onClick={onCatalog}>
          {t('fundamentalsBackToCatalog')}
        </button>
      </div>
    </section>
  );
}
