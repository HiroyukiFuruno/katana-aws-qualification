import { useEffect, useState } from 'react';
import {
  clearAnalyticsCookies,
  cookiesAllowed,
  openCookieSettings,
  useCookieConsent,
} from './CookieConsent';
import { usePreferences } from './preferences';

const analyticsId = 'G-XS97G1267H';
const preferenceKey = 'katana-aws:analytics-consent';
const disableKey = `ga-disable-${analyticsId}` as const;
const browser = window as Window & { [disableKey]?: boolean; dataLayer?: unknown[] };

function readConsent() {
  try {
    return localStorage.getItem(preferenceKey) === 'granted';
  } catch {
    return false;
  }
}

function applyConsent(consent: boolean) {
  consent = consent && cookiesAllowed();
  browser[disableKey] = !consent;
  if (!consent || document.getElementById('katana-analytics')) return;

  browser.dataLayer ??= [];
  const dataLayer = browser.dataLayer;
  // Google tags consume the IArguments queue described by the gtag API.
  function gtag(..._args: unknown[]) {
    // biome-ignore lint/complexity/noArguments: The Google tag queue expects an arguments object.
    dataLayer.push(arguments);
  }
  gtag('js', new Date());
  gtag('config', analyticsId, {
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });

  const script = document.createElement('script');
  script.id = 'katana-analytics';
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${analyticsId}`;
  document.head.appendChild(script);
}

export function initializeAnalytics(allowed = cookiesAllowed()) {
  applyConsent(allowed && readConsent());
}

export function AnalyticsSettings() {
  const { t } = usePreferences();
  const cookieConsent = useCookieConsent();
  const [consent, setConsent] = useState(readConsent);
  useEffect(() => {
    setConsent(cookieConsent === 'granted' && readConsent());
  }, [cookieConsent]);
  return (
    <section className="card" aria-label={t('privacy')}>
      <label>
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => {
            const granted = event.currentTarget.checked;
            if (granted && !cookiesAllowed()) {
              openCookieSettings();
              return;
            }
            try {
              localStorage.setItem(preferenceKey, granted ? 'granted' : 'denied');
            } catch {
              // The preference still applies for the current page.
            }
            browser[disableKey] = !granted;
            if (!granted) {
              clearAnalyticsCookies();
            }
            applyConsent(granted);
            setConsent(granted);
          }}
        />{' '}
        {t('analytics')}
      </label>
      <p>{t('analyticsScope')}</p>
    </section>
  );
}
