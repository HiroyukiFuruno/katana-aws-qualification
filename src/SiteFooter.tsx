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
  const [consent, setConsent] = useState(readConsent);

  useEffect(() => {
    browser[disableKey] = !consent;
    if (!consent || document.getElementById('katana-analytics')) return;

    const dataLayer = browser.dataLayer ??= [];
    function gtag(..._args: unknown[]) { dataLayer.push(arguments); }
    gtag('js', new Date());
    gtag('config', analyticsId, { allow_google_signals: false, allow_ad_personalization_signals: false });

    const script = document.createElement('script');
    script.id = 'katana-analytics';
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${analyticsId}`;
    document.head.appendChild(script);
  }, [consent]);

  return <footer className="shell site-footer">
    <a href="https://katana-series.katana-projects.org/">KatanA シリーズ公式サイト</a>
    <details><summary>プライバシー設定</summary>
      <label><input type="checkbox" checked={consent} onChange={event => {
        const granted = event.currentTarget.checked;
        try {
          localStorage.setItem(preferenceKey, granted ? 'granted' : 'denied');
        } catch {
          // The preference still applies for the current page.
        }
        browser[disableKey] = !granted;
        if (!granted) {
          for (const cookie of ['_ga', '_ga_XS97G1267H']) {
            document.cookie = `${cookie}=; Max-Age=0; Path=/`;
            document.cookie = `${cookie}=; Max-Age=0; Path=/; Domain=${location.hostname}`;
          }
        }
        setConsent(granted);
      }} /> GA4 によるアクセス計測を許可する</label>
      <p>学習履歴や回答内容は計測に送信しません。</p>
    </details>
  </footer>;
}
