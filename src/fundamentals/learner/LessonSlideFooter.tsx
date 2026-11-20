import { type MouseEvent, useRef } from 'react';
import { usePreferences } from '../../preferences';

type LessonSlideFooterProps = {
  previousHref?: string;
  saving: boolean;
  error?: string;
  onPrevious?: () => void | Promise<void>;
  onNext?: () => void | Promise<void>;
  onRetry?: () => void | Promise<void>;
  onActionError?: (error: unknown) => void;
  nextLabel?: string;
};

export function LessonSlideFooter({
  previousHref,
  saving,
  error,
  onPrevious,
  onNext,
  onRetry,
  onActionError,
  nextLabel,
}: LessonSlideFooterProps) {
  const { t } = usePreferences();
  const actionBusy = useRef(false);
  async function run(action: () => void | Promise<void>) {
    if (actionBusy.current || saving) return;
    actionBusy.current = true;
    try {
      await action();
    } catch (cause) {
      if (onActionError) onActionError(cause);
      else throw cause;
    } finally {
      actionBusy.current = false;
    }
  }
  function previousClick(event: MouseEvent<HTMLAnchorElement>) {
    if (
      !onPrevious ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    void run(onPrevious);
  }
  return (
    <footer className="lesson-slide-actions">
      {previousHref ? (
        <a
          className="lesson-slide-action"
          href={previousHref}
          onClick={previousClick}
          aria-disabled={saving}
        >
          {t('lessonPrevious')}
        </a>
      ) : (
        <span className="lesson-slide-action is-disabled" aria-disabled="true">
          {t('lessonPrevious')}
        </span>
      )}
      <div className="lesson-slide-save-state">
        {saving ? <span role="status">{t('lessonSaving')}</span> : null}
        {error ? (
          <p role="alert">
            {error}{' '}
            {onRetry ? (
              <button type="button" onClick={() => void onRetry()} disabled={saving}>
                {t('lessonRetry')}
              </button>
            ) : null}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        className="primary"
        onClick={() => {
          if (onNext) void run(onNext);
        }}
        disabled={!onNext || saving}
      >
        {nextLabel ?? t('lessonNext')}
      </button>
    </footer>
  );
}
