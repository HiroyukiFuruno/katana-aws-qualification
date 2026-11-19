import { useState } from 'react';
import { usePreferences } from '../preferences';
import { useAccount } from './AuthContext';

export function ProviderButtons({ link = false }: { link?: boolean }) {
  const { service, state } = useAccount();
  const { locale, t } = usePreferences();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const available = service?.providers.filter(
    (provider) =>
      !link || !state.account?.identities.some((identity) => identity.provider === provider.backend),
  );
  if (link && !available?.length) return null;

  async function start(providerId: string) {
    if (!service) return;
    setBusy(true);
    setFailed(false);
    try {
      const url = await (link
        ? service.linkIdentity(providerId, locale)
        : service.signIn(providerId, locale));
      location.assign(url);
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <div className="account-providers">
      {available?.map((provider) => (
        <button
          key={provider.id}
          type="button"
          className="primary"
          disabled={busy}
          onClick={() => void start(provider.id)}
        >
          {t(link ? 'accountLinkProvider' : 'accountSignInProvider', { provider: provider.name })}
        </button>
      ))}
      {!service?.providers.length && <p role="status">{t('accountUnavailable')}</p>}
      {failed && <p role="alert">{t('accountActionFailed')}</p>}
    </div>
  );
}
