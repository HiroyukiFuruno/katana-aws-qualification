import { useEffect } from 'react';
import { DashboardPage } from '../dashboard/DashboardPage';
import { localePath } from '../locales';
import { usePreferences } from '../preferences';
import { useSitePreferences } from '../sitePreferences/context';
import { AccountBenefits } from './AccountBenefits';
import { AccountSettings } from './AccountSettings';
import { useAccount } from './AuthContext';
import { accountSettingsPath, dashboardPath } from './navigation';
import { ProviderButtons } from './ProviderButtons';

export function AccountPages({ page, hash }: { page: string; hash: string }) {
  const { state, service } = useAccount();
  const { locale, t } = usePreferences();
  const site = useSitePreferences();
  const loggedIn = state.status === 'ready' && state.account !== null;
  const microsoftEnabled = service?.providers.some((provider) => provider.id === 'microsoft') === true;
  const preparingPreferences =
    site.loading ||
    (site.kind === 'member' && site.values.locale !== null && site.values.locale !== locale);

  const legacySettings = page === 'dashboard' && hash === '#account-settings';
  useEffect(() => {
    if (legacySettings) location.replace(accountSettingsPath(locale));
    if (page === 'login' && loggedIn) location.replace(dashboardPath(locale));
  }, [legacySettings, page, loggedIn, locale]);

  if (page === 'account/settings' || legacySettings) return <AccountSettings />;

  if (
    page === 'dashboard' &&
    state.status !== 'loading' &&
    state.status !== 'error' &&
    !preparingPreferences
  )
    return <DashboardPage />;

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
            {microsoftEnabled && <p>{t('accountOrganizationApproval')}</p>}
            <a href={localePath(locale, 'study')}>{t('accountGuestStudy')}</a>
          </section>
          <AccountBenefits />
        </div>
      ) : (
        <section className="card">
          <p role="status">{t('accountLoading')}</p>
          <a className="entry-action" href={dashboardPath(locale)}>
            {t('accountDashboard')}
          </a>
        </section>
      )}
    </main>
  );
}
