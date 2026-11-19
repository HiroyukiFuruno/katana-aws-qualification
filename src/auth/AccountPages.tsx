import { useEffect } from 'react';
import { localePath } from '../locales';
import { usePreferences } from '../preferences';
import { AccountBenefits } from './AccountBenefits';
import { AccountSettings } from './AccountSettings';
import { useAccount } from './AuthContext';
import { dashboardPath } from './navigation';
import { ProviderButtons } from './ProviderButtons';

export function AccountPages({ page }: { page: string }) {
  const { state } = useAccount();
  const { locale, t } = usePreferences();
  const loggedIn = state.status === 'ready' && state.account !== null;

  useEffect(() => {
    if (page === 'login' && loggedIn) location.replace(dashboardPath(locale));
  }, [page, loggedIn, locale]);

  return (
    <main id="main" className="shell account-page">
      <h1>{t(page === 'dashboard' ? 'accountDashboard' : 'accountSignIn')}</h1>
      {state.status === 'loading' ? (
        <p role="status">{t('accountLoading')}</p>
      ) : state.status === 'error' ? (
        <section className="card">
          <p role="alert">{t('accountSessionFailed')}</p>
          <ProviderButtons />
        </section>
      ) : !loggedIn ? (
        <div className="account-login-layout">
          <section className="card account-login-card">
            <p className="eyebrow">{t('accountLoginEyebrow')}</p>
            <h2>{t('accountLoginTitle')}</h2>
            <p>{t('accountSsoOnly')}</p>
            <ProviderButtons />
            <a href={localePath(locale, 'study')}>{t('accountGuestStudy')}</a>
          </section>
          <AccountBenefits />
        </div>
      ) : (
        <>
          <section className="card">
            <p>{t('accountDashboardPending')}</p>
            <a className="entry-action" href={localePath(locale, 'study')}>
              {t('study')}
            </a>
          </section>
          <AccountSettings />
        </>
      )}
    </main>
  );
}
