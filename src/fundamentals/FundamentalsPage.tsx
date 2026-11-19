import { useEffect, useRef, useState } from 'react';
import type { Attempt } from '../attempts';
import { saveAttempt } from '../history';
import { usePreferences } from '../preferences';
import { QuestionCard } from '../QuestionCard';
import { questionKey } from '../questions';
import { FundamentalsCatalog, latestFor } from './FundamentalsCatalog';
import { FundamentalsLesson } from './FundamentalsLesson';
import { FundamentalsResults } from './FundamentalsResults';
import {
  advanceSession,
  createSession,
  type FundamentalsSession,
  hasUnansweredQuestions,
  sessionComplete,
} from './session';
import type { FundamentalsUnit } from './types';
import { useFundamentalsContent } from './useFundamentalsContent';
import { useFundamentalsHistory } from './useFundamentalsHistory';
import './fundamentals.css';

function sessionFor(unit: FundamentalsUnit, attempts: Attempt[], review: boolean) {
  const nextSession = createSession(unit, attempts, review);
  return !review && !nextSession.questions.length
    ? { ...nextSession, questions: unit.questions }
    : nextSession;
}

export function FundamentalsPage() {
  const { t } = usePreferences();
  const { content, error, reload } = useFundamentalsContent();
  const { attempts, historyError, historyLoaded, setAttempts } = useFundamentalsHistory();
  const [session, setSession] = useState<FundamentalsSession>();
  const [showResults, setShowResults] = useState(false);
  const [initialUnitId] = useState(() => new URLSearchParams(location.search).get('unit'));
  const [initialReview] = useState(() => new URLSearchParams(location.search).get('review') === '1');
  const initialSessionStarted = useRef(false);
  const unit = content?.units.find((item) => item.id === session?.unitId);
  const question = session?.questions[session.index];
  const latest = latestFor(attempts);

  useEffect(() => {
    if (initialSessionStarted.current || !content || !historyLoaded || !initialUnitId) return;
    initialSessionStarted.current = true;
    const initialUnit = content.units.find((item) => item.id === initialUnitId);
    if (initialUnit) setSession(sessionFor(initialUnit, attempts, initialReview));
  }, [attempts, content, historyLoaded, initialReview, initialUnitId]);

  function openUnit(id: string, asReview = false) {
    const unitToOpen = content?.units.find((item) => item.id === id);
    setSession(unitToOpen ? sessionFor(unitToOpen, attempts, asReview) : undefined);
    setShowResults(false);
    history.replaceState(
      null,
      '',
      `${location.pathname}?unit=${encodeURIComponent(id)}${asReview ? '&review=1' : ''}`,
    );
  }

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
      <h1>{unit.title}</h1>
      <p>{unit.summary}</p>
      {historyError && (
        <p className="notice" role="alert">
          {t('fundamentalsHistoryUnavailable')}
        </p>
      )}
      <FundamentalsLesson unit={unit} />
      {showResults ? (
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
        <div className="fundamentals-question">
          <p className="eyebrow">
            {t('fundamentalsQuestionNumber', {
              current: session.index + 1,
              total: session.questions.length,
            })}
          </p>
          <QuestionCard
            key={`${questionKey(question)}:${session.review ? 'review' : 'study'}:${session.index}`}
            question={question}
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
        </div>
      )}
    </main>
  );
}
