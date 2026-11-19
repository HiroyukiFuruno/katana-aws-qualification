import { useEffect, useRef, useState } from 'react';
import { localePath } from '../locales';
import { usePreferences } from '../preferences';
import { useAccount } from './AuthContext';
import { callbackFailureKind } from './callbackFailure';
import { dashboardPath } from './navigation';
import { ProviderButtons } from './ProviderButtons';

export function AuthCallback() {
  const { service } = useAccount();
  const { locale, t } = usePreferences();
  const started = useRef(false);
  const [failure, setFailure] = useState<ReturnType<typeof callbackFailureKind>>();
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const search = location.search;
    history.replaceState(null, '', location.pathname);
    if (!service) {
      setFailure('unknown');
      return;
    }
    service.completeCallback(search).then(
      () => location.replace(dashboardPath(locale)),
      (error: unknown) => setFailure(callbackFailureKind(error, search)),
    );
  }, [service, locale]);

  return (
    <main id="main" className="shell account-page">
      <h1>{t('accountSignIn')}</h1>
      {failure ? (
        <>
          <p role="alert" data-auth-failure={failure}>
            {t(
              failure === 'browser'
                ? 'accountBrowserChanged'
                : failure === 'organization'
                  ? 'accountOrganizationApproval'
                  : failure === 'unknown'
                    ? 'accountActionFailed'
                    : 'accountCallbackFailed',
            )}
          </p>
          {failure === 'browser' && <ProviderButtons />}
          <a href={localePath(locale, 'login')}>{t('accountSignIn')}</a>
        </>
      ) : (
        <p role="status">{t('accountLoading')}</p>
      )}
    </main>
  );
}
