import { localePath } from '../locales';
import { usePreferences } from '../preferences';
import { useAccount } from './AuthContext';

export function useHomePath() {
  const { state } = useAccount();
  const { locale } = usePreferences();
  return localePath(locale, state.status === 'ready' && state.account ? 'dashboard' : '');
}

export function AccountNavigation() {
  const { state } = useAccount();
  const { locale, t } = usePreferences();
  const signedIn = state.status === 'ready' && state.account;
  return (
    <a href={localePath(locale, signedIn ? 'dashboard' : 'login')}>
      {t(signedIn ? 'accountDashboard' : 'accountSignIn')}
    </a>
  );
}
