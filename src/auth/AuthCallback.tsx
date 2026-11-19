import { useEffect, useRef, useState } from 'react';
import { localePath } from '../locales';
import { usePreferences } from '../preferences';
import { useAccount } from './AuthContext';
import { dashboardPath } from './navigation';

export function AuthCallback() {
  const { service } = useAccount();
  const { locale, t } = usePreferences();
  const started = useRef(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const search = location.search;
    history.replaceState(null, '', location.pathname);
    if (!service) {
      setFailed(true);
      return;
    }
    service.completeCallback(search).then(
      () => location.replace(dashboardPath(locale)),
      () => setFailed(true),
    );
  }, [service, locale]);

  return (
    <main id="main" className="shell account-page">
      <h1>{t('accountSignIn')}</h1>
      {failed ? (
        <>
          <p role="alert">{t('accountCallbackFailed')}</p>
          <a href={localePath(locale, 'login')}>{t('accountSignIn')}</a>
        </>
      ) : (
        <p role="status">{t('accountLoading')}</p>
      )}
    </main>
  );
}
