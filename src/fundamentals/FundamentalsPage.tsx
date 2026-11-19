import { useEffect, useRef } from 'react';
import { saveAttempt } from '../history';
import { usePreferences } from '../preferences';
import { questionKey } from '../questions';
import { FundamentalsCatalog, latestFor } from './FundamentalsCatalog';
import { FundamentalsLesson } from './FundamentalsLesson';
import { FundamentalsPractice } from './FundamentalsPractice';
import { FundamentalsResults } from './FundamentalsResults';
import { advanceSession, createSession, hasUnansweredQuestions, sessionComplete } from './session';
import { useFundamentalsContent } from './useFundamentalsContent';
import { useFundamentalsHistory } from './useFundamentalsHistory';
import { useFundamentalsSession } from './useFundamentalsSession';
import './fundamentals.css';

export function FundamentalsPage() {
  const { t } = usePreferences();
  const { content, error, reload } = useFundamentalsContent();
  const { attempts, historyError, historyLoaded, setAttempts } = useFundamentalsHistory();
  const { session, setSession, practice, setPractice, showResults, setShowResults, openUnit } =
    useFundamentalsSession(content, attempts, historyLoaded);
  const unit = content?.units.find((item) => item.id === session?.unitId);
  const title = useRef<HTMLHeadingElement>(null);
  const question = session?.questions[session.index];
  const latest = latestFor(attempts);
  const activeScreen = unit ? `${unit.id}:${session?.index ?? 0}:${practice}:${showResults}` : undefined;

  useEffect(() => {
    if (!activeScreen || !title.current) return;
    title.current.scrollIntoView({ block: 'start' });
    title.current.focus({ preventScroll: true });
  }, [activeScreen]);

  if (error)
    return (
      <main id="main" className="shell fundamentals-page">
        <p role="alert">{t('fundamentalsLoadError')}</p>
        <button type="button" onClick={reload}>
          {t('fundamentalsReload')}
        </button>
      </main>
    );
  if (!content)
    return (
      <main id="main" className="shell fundamentals-page">
        <p role="status">{t('fundamentalsLoading')}</p>
      </main>
    );
  if (!unit || !session)
    return (
      <FundamentalsCatalog
        content={content}
        latest={latest}
        historyUnavailable={historyError}
        openUnit={openUnit}
      />
    );

  const nextUnit = content.units.find((candidate) => candidate.id === unit.next);
  const reviewAvailable = createSession(unit, attempts, true).questions.length > 0;
  const unanswered = hasUnansweredQuestions(unit, attempts);
  return (
    <main id="main" className="shell fundamentals-page">
      <p>
        <button className="fundamentals-back" type="button" onClick={() => openUnit('')}>
          {t('fundamentalsBackToCatalog')}
        </button>
      </p>
      <p className="eyebrow">
        {unit.order} / {content.catalog.length} · {session.review ? t('review') : t('study')}
      </p>
      <h1 ref={title} tabIndex={-1}>
        {unit.title}
      </h1>
      <p>{unit.summary}</p>
      {historyError && (
        <p className="notice" role="alert">
          {t('fundamentalsHistoryUnavailable')}
        </p>
      )}
      <ol className="fundamentals-steps" aria-label={t('fundamentalsLearningSteps')}>
        <li aria-current={!practice ? 'step' : undefined}>{t('fundamentalsReadStep')}</li>
        <li aria-current={practice && !showResults ? 'step' : undefined}>
          {t('fundamentalsPracticeStep')}
        </li>
        <li aria-current={showResults ? 'step' : undefined}>{t('fundamentalsReviewStep')}</li>
      </ol>
      {!practice ? (
        <>
          <p className="notice">{t('fundamentalsReadBeforePractice')}</p>
          <FundamentalsLesson unit={unit} />
          <button className="primary" type="button" onClick={() => setPractice(true)}>
            {t('fundamentalsStartPractice', { total: session.questions.length })}
          </button>
        </>
      ) : showResults ? (
        <FundamentalsResults
          hasReview={reviewAvailable}
          hasUnanswered={unanswered}
          onCatalog={() => openUnit('')}
          onNext={unanswered || !nextUnit ? undefined : () => openUnit(nextUnit.id)}
          onReview={() => openUnit(unit.id, true)}
          onStudy={() => openUnit(unit.id)}
          unit={unit}
        />
      ) : !question ? (
        <p className="notice">{t('fundamentalsNoReview')}</p>
      ) : (
        <FundamentalsPractice
          key={`${questionKey(question)}:${session.review ? 'review' : 'study'}:${session.index}`}
          unit={unit}
          question={question}
          current={session.index + 1}
          total={session.questions.length}
          last={sessionComplete(session)}
          onNext={() =>
            sessionComplete(session) ? setShowResults(true) : setSession(advanceSession(session))
          }
          onAnswer={async (selected, elapsed) => {
            const result = await saveAttempt(
              question,
              selected,
              session.review ? 'review' : 'study',
              elapsed,
            );
            setAttempts(result.history);
            return result.attempt;
          }}
        />
      )}
    </main>
  );
}
