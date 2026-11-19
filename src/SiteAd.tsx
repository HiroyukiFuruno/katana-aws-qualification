import { useEffect, useRef } from 'react';

import { useCookieConsent } from './CookieConsent';

const publisher = 'ca-pub-6906125453421012';
const slot = '1732021005';
const enabled = import.meta.env.PROD && import.meta.env.VITE_ADSENSE_SERVING === '1';

export function SiteAd() {
  const consent = useCookieConsent();
  const allowed = enabled && consent.value === 'granted';
  const requested = useRef(false);
  useEffect(() => {
    if (!allowed || requested.current) return;
    requested.current = true;

    const browser = window as Window & { adsbygoogle?: object[] };
    browser.adsbygoogle ??= [];
    browser.adsbygoogle.push({});
    if (document.getElementById('kaq-adsense')) return;

    const script = document.createElement('script');
    script.id = 'kaq-adsense';
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisher}`;
    document.head.appendChild(script);
  }, [allowed]);

  return allowed ? (
    <ins
      className="adsbygoogle"
      style={{ display: 'block', marginBlockStart: '1rem' }}
      data-ad-client={publisher}
      data-ad-slot={slot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  ) : null;
}
