import { useState } from 'react';
import { localePath } from '../../locales';
import { usePreferences } from '../../preferences';
import { SiteAd, SiteAdLayout } from '../../SiteAd';
import type { DeliveryUnitAsset } from '../delivery/artifactTypes';
import type { LessonSnapshot } from '../state/types';
import { LessonResultQuestion } from './LessonResultQuestion';
import { finalPresentation } from './lesson-presentation';
import { submittedSession } from './lesson-result-helpers';
import './lesson-result.css';

type LessonResultProps = {
  asset: DeliveryUnitAsset;
  snapshot: LessonSnapshot;
  sessionId?: string;
  contentVersion?: string;
  onRetry: () => Promise<void>;
  onNavigate: (href: string) => void | Promise<void>;
  busy?: boolean;
  error?: string;
  onActionError?: (error: unknown) => void;
  onReloadSaved?: () => Promise<void>;
};

export function LessonResult({
  asset,
  snapshot,
  sessionId,
  contentVersion,
  onRetry,
  onNavigate,
  busy = false,
  error,
  onActionError,
  onReloadSaved,
}: LessonResultProps) {
  const { locale, t } = usePreferences();
  const [actionError, setActionError] = useState<{ cause: unknown }>();
  const session = submittedSession(snapshot.sessions, sessionId);
  const catalogHref = localePath(locale, 'study/fundamentals');
  const reportError = (cause: unknown) => {
    setActionError({ cause });
    onActionError?.(cause);
  };
  const navigate = (href: string) => {
    void Promise.resolve()
      .then(() => onNavigate(href))
      .catch(reportError);
  };
  const retry = () => {
    setActionError(undefined);
    void onRetry().catch(reportError);
  };
  const answered = session
    ? asset.finalQuestions.filter((_, index) => session.responses[String(index)]?.selected.length > 0)
        .length
    : 0;
  const passedBefore = Boolean(snapshot.progress.passedFinalSessionId && snapshot.progress.passedAt);
  return (
    <SiteAdLayout show>
      <main id="main" className="shell fundamentals-page lesson-result-page">
        <header className="intro">
          <p className="eyebrow">{t('results')}</p>
          <h1>{t('fundamentalsResultsTitle', { title: asset.unit.title })}</h1>
          {session ? (
            <>
              {session.submittedAt && (
                <p className="lesson-result-session">
                  {t('fundamentalsResultSubmittedAt')}:{' '}
                  <time dateTime={session.submittedAt}>{session.submittedAt}</time>
                </p>
              )}
              {session.score !== null ? (
                <p className="lesson-result-score" aria-live="polite">
                  {t('score', { correct: session.score, total: asset.finalQuestions.length })} ·{' '}
                  {session.requiredScore} / {asset.finalQuestions.length}{' '}
                  {t('fundamentalsResultRequired')} · {Math.round(asset.finalPolicy.ratio * 100)}%{' '}
                  {t('fundamentalsResultPassRate')}
                </p>
              ) : (
                <p role="alert">{t('fundamentalsResultNoScore')}</p>
              )}
              {session.passed === true && <p className="lesson-result-pass">{t('lessonPassed')}</p>}
              {session.passed === false && (
                <p className="lesson-result-fail">
                  {t('lessonNotPassed')} · {t('fundamentalsReviewNeeded')}
                </p>
              )}
              {session.passed === false && passedBefore && <p>{t('fundamentalsResultPreviousPass')}</p>}
              <p>
                {t('answered')}: {answered} / {asset.finalQuestions.length}
              </p>
              <p>
                {t('fundamentalsResultUnansweredCount')}: {asset.finalQuestions.length - answered}
              </p>
            </>
          ) : (
            <p role="alert">{t('fundamentalsResultUnavailable')}</p>
          )}
        </header>
        <SiteAd placement="inline" />
        {error && (
          <p className="notice" role="alert">
            {error}
            {onReloadSaved ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  void onReloadSaved().catch(reportError);
                }}
              >
                {t('examReloadSaved')}
              </button>
            ) : null}
          </p>
        )}
        {actionError && (
          <p className="notice" role="alert">
            {t('fundamentalsActionFailed')}
          </p>
        )}
        {session && (
          <section className="lesson-result-questions" aria-labelledby="lesson-result-review">
            <h2 id="lesson-result-review">{t('fundamentalsResultReview')}</h2>
            {finalPresentation(asset, session.sessionId).map(
              ({ canonicalPosition, question }, index) => (
                <LessonResultQuestion
                  key={`${question.id}-${question.revision}`}
                  asset={asset}
                  question={question}
                  session={session}
                  index={canonicalPosition}
                  position={index + 1}
                  locale={locale}
                  contentVersion={contentVersion}
                  onNavigate={navigate}
                />
              ),
            )}
          </section>
        )}
        <nav className="lesson-result-actions" aria-label={t('navigation')}>
          <button type="button" className="primary" disabled={busy} onClick={retry}>
            {t('fundamentalsResultRetake')}
          </button>
          <a
            href={catalogHref}
            onClick={(event) => {
              event.preventDefault();
              navigate(catalogHref);
            }}
          >
            {t('fundamentalsBackToCatalog')}
          </a>
        </nav>
      </main>
    </SiteAdLayout>
  );
}
