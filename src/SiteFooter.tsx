import { localePath } from './locales';
import { usePreferences } from './preferences';
import { useEffect, useState } from 'react';

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

export function SiteFooter() {
  const { t, locale } = usePreferences();
  const [consent, setConsent] = useState(readConsent);

  useEffect(() => {
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
  }, [consent]);

  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div className="footer-brand">
          <a className="brand" href={localePath(locale)}>
            KatanA<span> AWS</span>
          </a>
          <a href={`https://katana-series.katana-projects.org${localePath(locale)}`}>{t('series')}</a>
        </div>
        <nav aria-label={t('footerNavigation')}>
          <a href={localePath(locale, 'study')}>{t('study')}</a>
          <a href={localePath(locale, 'assessment')}>{t('skillsAssessment')}</a>
        </nav>
        <details>
          <summary>{t('privacy')}</summary>
          <label>
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => {
                const granted = event.currentTarget.checked;
                try {
                  localStorage.setItem(preferenceKey, granted ? 'granted' : 'denied');
                } catch {
                  // The preference still applies for the current page.
                }
                browser[disableKey] = !granted;
                if (!granted) {
                  for (const cookie of ['_ga', '_ga_XS97G1267H']) {
                    // biome-ignore lint/suspicious/noDocumentCookie: Synchronously clear the existing GA4 cookie on opt-out.
                    document.cookie = `${cookie}=; Max-Age=0; Path=/`;
                    // biome-ignore lint/suspicious/noDocumentCookie: Also clear the domain-scoped GA4 cookie.
                    document.cookie = `${cookie}=; Max-Age=0; Path=/; Domain=${location.hostname}`;
                  }
                }
                setConsent(granted);
              }}
            />{' '}
            {t('analytics')}
          </label>
          <p>{t('analyticsScope')}</p>
        </details>
      </div>
    </footer>
  );
}
