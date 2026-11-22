import { type MouseEvent, type ReactNode, useId, useLayoutEffect, useRef } from 'react';
import { usePreferences } from '../../preferences';
import type { LessonStep } from '../delivery/slideTypes';
import { LessonSlideFooter } from './LessonSlideFooter';
import './learner.css';
import './learner-responsive.css';

export type LessonSlideShellProps = {
  step: LessonStep;
  unitTitle: string;
  catalogHref: string;
  onCatalog?: () => void | Promise<void>;
  children: ReactNode;
  previousHref?: string;
  adSlot?: ReactNode;
  saving?: boolean;
  error?: string;
  onPrevious?: () => void | Promise<void>;
  onNext?: () => void | Promise<void>;
  onRetry?: () => void | Promise<void>;
  onActionError?: (error: unknown) => void;
  nextLabel?: string;
};

// 保存・遷移・翻訳は親が所有し、このシェルは固定プランの表示だけを担う。
export function LessonSlideShell({
  step,
  unitTitle,
  catalogHref,
  onCatalog,
  children,
  previousHref,
  adSlot,
  saving = false,
  error,
  onPrevious,
  onNext,
  onRetry,
  onActionError,
  nextLabel,
}: LessonSlideShellProps) {
  const { t } = usePreferences();
  const headingId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const catalogBusy = useRef(false);
  const total = Math.max(step.totalSteps, 1);
  const position = Math.min(Math.max(step.position, 1), total);
  const minutes = Math.max(1, Math.ceil(step.estimatedSeconds / 60));
  useLayoutEffect(() => {
    if (step.id) {
      window.scrollTo(0, 0);
      heading.current?.focus({ preventScroll: true });
    }
  }, [step.id]);

  function catalogClick(event: MouseEvent<HTMLAnchorElement>) {
    if (
      !onCatalog ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    if (saving || catalogBusy.current) return;
    catalogBusy.current = true;
    Promise.resolve(onCatalog())
      .catch((cause: unknown) => {
        if (onActionError) onActionError(cause);
        else throw cause;
      })
      .finally(() => {
        catalogBusy.current = false;
      });
  }

  return (
    <section className="lesson-slide-shell" aria-busy={saving} aria-labelledby={headingId}>
      <header className="lesson-slide-header">
        <a
          className="lesson-slide-catalog"
          href={catalogHref}
          onClick={catalogClick}
          aria-disabled={saving}
        >
          {t('lessonBackToCatalog')}
        </a>
        <p className="lesson-slide-unit">{unitTitle}</p>
        <div className="lesson-slide-meta">
          <span aria-live="polite">{t('lessonStepProgress', { current: position, total })}</span>
          <span>{t('lessonStepsRemaining', { count: Math.max(step.remainingSteps, 0) })}</span>
          <span>
            {step.estimatedSeconds < 60
              ? t('lessonEstimatedSeconds', { count: step.estimatedSeconds })
              : t('lessonEstimatedMinutes', { count: minutes })}
          </span>
        </div>
        <progress aria-label={t('lessonProgress')} max={total} value={position}>
          {position} / {total}
        </progress>
      </header>
      <main id="main" className="lesson-slide-stage" aria-labelledby={headingId}>
        <div className="lesson-slide-content">
          <h1 id={headingId} ref={heading} tabIndex={-1}>
            {step.kind === 'checkpoint' ? t('lessonAssessment') : step.label}
          </h1>
          {adSlot}
          {children}
        </div>
      </main>
      <LessonSlideFooter
        previousHref={previousHref}
        saving={saving}
        error={error}
        onPrevious={onPrevious}
        onNext={onNext}
        onRetry={onRetry}
        onActionError={onActionError}
        nextLabel={nextLabel}
        onExit={onCatalog}
      />
    </section>
  );
}
