import { Fragment, type ReactNode } from 'react';
import { useAccount } from '../auth/AuthContext';
import { localePath } from '../locales';
import { usePreferences } from '../preferences';
import { ProgressConsent } from './ProgressConsent';
import { useProgress } from './ProgressProvider';
import { MigrationPrompt } from './MigrationPrompt';

export function GuestStorageSettings() {
  const { status, store, retry } = useProgress();
  return status === 'ready' && store?.getSnapshot().owner.kind === 'guest' ? (
    <ProgressConsent onChange={retry} />
  ) : null;
}

export function ProgressGate({ children }: { children: ReactNode }) {
  const { state: auth } = useAccount();
  const { locale, t } = usePreferences();
  const { status, store, migrationAccess, retry } = useProgress();
  if (status !== 'ready' || !store) {
    const failed = status === 'error';
    const authFailed = auth.status === 'error';
    return (
      <main id="main" className="shell progress-status" aria-busy={!failed}>
        <p role={failed ? 'alert' : 'status'}>
          {t(
            authFailed
              ? 'progressAuthFailed'
              : failed
                ? 'progressCloudLoadFailed'
                : 'progressAuthLoading',
          )}
        </p>
        {failed &&
          (authFailed ? (
            <a href={localePath(locale, 'login')}>{t('accountSignIn')}</a>
          ) : (
            <button type="button" onClick={retry}>
              {t('progressRetry')}
            </button>
          ))}
      </main>
    );
  }
  const snapshot = store.getSnapshot();
  const owner = snapshot.owner;
  const key = `${owner.kind}:${owner.generation}:${owner.kind === 'member' ? owner.userId : ''}`;
  return (
    <Fragment key={key}>
      <aside className="shell progress-status" aria-label={t('progressStorageTitle')}>
        <p className="progress-source">
          {t(owner.kind === 'member' ? 'progressAccountSource' : 'progressGuestSource')}
        </p>
        {owner.kind === 'guest' && <ProgressConsent compact onChange={retry} />}
        {snapshot.error && (
          <p role="alert">
            {t(snapshot.error === 'load' ? 'progressCloudLoadFailed' : 'progressCloudSaveFailed')}
          </p>
        )}
        {snapshot.error && (
          <button type="button" onClick={retry}>
            {t('progressRetry')}
          </button>
        )}
      </aside>
      {owner.kind === 'member' && <MigrationPrompt access={migrationAccess} />}
      {children}
    </Fragment>
  );
}
