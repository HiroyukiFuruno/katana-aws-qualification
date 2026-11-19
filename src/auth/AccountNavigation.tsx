import { useState } from 'react';
import { localePath } from '../locales';
import { usePreferences } from '../preferences';
import { useDismissiblePopover } from '../useDismissiblePopover';
import { useAccount } from './AuthContext';
import './account.css';

export function useHomePath() {
  const { state } = useAccount();
  const { locale } = usePreferences();
  return localePath(locale, state.status === 'ready' && state.account ? 'dashboard' : '');
}

export function AccountNavigation() {
  const { state, service } = useAccount();
  const { locale, t } = usePreferences();
  const [open, setOpen] = useState(false);
  const [avatarFailedFor, setAvatarFailedFor] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const { group, button } = useDismissiblePopover(open, setOpen);
  const signedIn = state.status === 'ready' && state.account;
  const account = signedIn ? state.account : null;
  const label = account?.displayName || account?.email || t('accountProfileFallback');
  const avatarUrl =
    account?.avatarUrl && account.avatarUrl !== avatarFailedFor ? account.avatarUrl : undefined;

  async function signOut() {
    if (!service) return;
    setBusy(true);
    setFailed(false);
    try {
      await service.signOut();
      location.replace(localePath(locale));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="account-menu" ref={group}>
      <button
        ref={button}
        type="button"
        className="account-avatar-button"
        aria-controls="account-menu-links"
        aria-expanded={open}
        aria-label={t('accountMenuLabel')}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="account-avatar" aria-hidden="true">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              referrerPolicy="no-referrer"
              onError={() => setAvatarFailedFor(avatarUrl)}
            />
          ) : (
            <svg className="account-avatar-icon" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="8" r="3.5" />
              <path d="M4.5 20c.8-3.5 3.3-5.5 7.5-5.5s6.7 2 7.5 5.5" />
            </svg>
          )}
        </span>
        <span className="account-avatar-label" title={account ? label : t('accountSignIn')}>
          {account ? label : t('accountSignIn')}
        </span>
      </button>
      <div className="account-menu-links" id="account-menu-links" hidden={!open}>
        {account ? (
          <>
            <p className="account-menu-heading">{label}</p>
            <a href={localePath(locale, 'dashboard')} onClick={() => setOpen(false)}>
              {t('accountDashboard')}
            </a>
            <a href={localePath(locale, 'dashboard')} onClick={() => setOpen(false)}>
              {t('accountSettings')}
            </a>
            <button type="button" disabled={busy} onClick={() => void signOut()}>
              {t('accountSignOut')}
            </button>
            {failed && (
              <p className="account-menu-error" role="alert">
                {t('accountActionFailed')}
              </p>
            )}
          </>
        ) : (
          <>
            <p className="account-menu-heading">{t('accountMenuGuest')}</p>
            <a className="primary" href={localePath(locale, 'login')} onClick={() => setOpen(false)}>
              {t('accountCreateCta')}
            </a>
            <span className="account-menu-pending">{t('accountGuestDashboard')}</span>
            <a href={localePath(locale, 'login')} onClick={() => setOpen(false)}>
              {t('accountSignIn')}
            </a>
          </>
        )}
      </div>
    </div>
  );
}
