import { useState } from 'react';
import { localePath } from '../locales';
import { usePreferences } from '../preferences';
import { useAccount } from './AuthContext';
import { DeleteAccount } from './DeleteAccount';
import { dashboardPath } from './navigation';
import { ProviderButtons } from './ProviderButtons';

export function AccountSettings() {
  const { state, service } = useAccount();
  const { locale, t } = usePreferences();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function perform(identityId?: string) {
    if (!service) return;
    setBusy(true);
    setFailed(false);
    try {
      if (identityId) {
        await service.unlinkIdentity(identityId);
        await service.refresh();
      } else {
        await service.signOut();
        location.replace(localePath(locale));
      }
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  if (state.status !== 'ready' || !state.account || !service) {
    return (
      <main id="main" className="shell account-page">
        <h1>{t('accountSettings')}</h1>
        {state.status === 'loading' ? (
          <p role="status">{t('accountLoading')}</p>
        ) : (
          <section className="card layout-stack">
            {state.status === 'error' && <p role="alert">{t('accountSessionFailed')}</p>}
            <a className="entry-action" href={localePath(locale, 'login')}>
              {t('accountSignIn')}
            </a>
          </section>
        )}
      </main>
    );
  }
  const account = state.account;
  return (
    <main id="main" className="shell account-page">
      <h1>{t('accountSettings')}</h1>
      <a className="account-settings-back" href={dashboardPath(locale)}>
        {t('accountDashboard')}
      </a>
      <section className="card layout-stack">
        {account.email && <p>{account.email}</p>}
        <h2>{t('accountLinkedProviders')}</h2>
        <ul className="action-list">
          {account.identities.map((identity) => (
            <li key={identity.id}>
              <span>
                {service.providers.find((provider) => provider.backend === identity.provider)?.name ??
                  identity.provider}
              </span>
              <button
                type="button"
                disabled={busy || account.identities.length < 2}
                onClick={() => void perform(identity.id)}
              >
                {t('accountUnlink')}
              </button>
            </li>
          ))}
        </ul>
        <p>{t('accountKeepIdentity')}</p>
        <ProviderButtons link />
        <button type="button" disabled={busy} onClick={() => void perform()}>
          {t('accountSignOut')}
        </button>
        {failed && <p role="alert">{t('accountActionFailed')}</p>}
      </section>
      <DeleteAccount key={account.id} />
    </main>
  );
}
