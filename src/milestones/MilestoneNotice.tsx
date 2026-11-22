import { usePreferences } from '../preferences';
import type { MilestonesModel } from './modelTypes';

export function MilestoneNotice({ model, reload }: { model: MilestonesModel; reload: () => void }) {
  const { t } = usePreferences();
  const failure =
    model.notice === 'load-error'
      ? 'milestoneLoadFailed'
      : model.notice === 'conflict'
        ? 'milestoneConflict'
        : model.notice === 'save-error'
          ? 'milestoneSaveFailed'
          : null;
  return (
    <>
      {model.loading && <p role="status">{t('milestoneLoading')}</p>}
      {model.notice === 'saving' && <p role="status">{t('dashboardSaving')}</p>}
      {model.notice === 'saved' && <p role="status">{t('milestoneSaved')}</p>}
      {failure && (
        <p role="alert">
          {t(failure)}{' '}
          <button type="button" onClick={reload}>
            {t('milestoneReload')}
          </button>
        </p>
      )}
    </>
  );
}
