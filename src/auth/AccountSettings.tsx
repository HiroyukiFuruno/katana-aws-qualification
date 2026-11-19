import { useState } from 'react';
import { localePath } from '../locales';
import { usePreferences } from '../preferences';
import { useAccount } from './AuthContext';
import { DeleteAccount } from './DeleteAccount';
import { ProviderButtons } from './ProviderButtons';

export function AccountSettings() {
  const { state, service } = useAccount();
  const { locale, t } = usePreferences();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  if (state.status !== 'ready' || !state.account || !service) return null;
  const account = state.account;

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

  return (
    <>
      <section className="card layout-stack">
        <h2>{t('accountSettings')}</h2>
        {account.email && <p>{account.email}</p>}
        <h3>{t('accountLinkedProviders')}</h3>
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
    </>
  );
}
