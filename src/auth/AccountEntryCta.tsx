import { localePath } from '../locales';
import { usePreferences } from '../preferences';
import { useAccount } from './AuthContext';

export function AccountEntryCta() {
  const { state } = useAccount();
  const { locale, t } = usePreferences();
  if (state.status !== 'ready' || state.account) return null;
  return (
    <a className="primary account-benefits-action" href={localePath(locale, 'login')}>
      {t('accountCreateCta')}
    </a>
  );
}
