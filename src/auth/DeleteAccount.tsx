import { useState } from 'react';
import { localePath } from '../locales';
import { usePreferences } from '../preferences';
import { useAccount } from './AuthContext';

export function DeleteAccount() {
  const { state, service } = useAccount();
  const { locale, t } = usePreferences();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  if (state.status !== 'ready' || !state.account || !service) return null;
  const accountService = service;
  const expectedAccountId = state.account.id;

  async function removeAccount() {
    setBusy(true);
    setFailed(false);
    try {
      await accountService.deleteAccount(expectedAccountId);
      location.replace(localePath(locale));
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <section className="card layout-stack" aria-labelledby="account-delete-title">
      <h2 id="account-delete-title">{t('accountDeleteTitle')}</h2>
      <p>{t('accountDeleteDescription')}</p>
      <p>{t('accountDeleteLearning')}</p>
      <a href={`${localePath(locale, 'privacy')}#account-deletion`}>{t('accountDeleteGuideLink')}</a>
      {confirming ? (
        <div className="layout-stack" role="alert">
          <p>{t('accountDeleteConfirmWarning')}</p>
          <div className="layout-stack">
            <button type="button" disabled={busy} onClick={() => void removeAccount()}>
              {t('accountDeleteConfirm')}
            </button>
            <button type="button" disabled={busy} onClick={() => setConfirming(false)}>
              {t('accountDeleteCancel')}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)}>
          {t('accountDeleteStart')}
        </button>
      )}
      {failed && <p role="alert">{t('accountActionFailed')}</p>}
    </section>
  );
}
