import { type ReactNode, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { useCookieConsent } from './CookieConsent';
import { usePreferences } from './preferences';
import './site-ad.css';

const publisher = 'ca-pub-6906125453421012';
const slot = '1732021005';
const siteAdServingEnabled = import.meta.env.PROD && import.meta.env.VITE_ADSENSE_SERVING === '1';

const mobile = window.matchMedia('(width < 768px)');
const wide = window.matchMedia('(width >= 1520px)');

function subscribeViewport(onChange: () => void) {
  mobile.addEventListener('change', onChange);
  wide.addEventListener('change', onChange);
  return () => {
    mobile.removeEventListener('change', onChange);
    wide.removeEventListener('change', onChange);
  };
}

function adViewport() {
  if (mobile.matches) return 'mobile';
  return wide.matches ? 'wide' : 'standard';
}

type Placement = 'bottom' | 'inline' | 'left' | 'right';

export function SiteAdLayout({
  children,
  show,
  viewKey = '',
}: {
  children: ReactNode;
  show: boolean;
  viewKey?: string;
}) {
  return (
    <>
      <div className="site-ad-layout">
        <div className="site-ad-content">{children}</div>
        {show && <SiteAd key={`left:${viewKey}`} placement="left" />}
        {show && <SiteAd key={`right:${viewKey}`} placement="right" />}
      </div>
      {show && <SiteAd key={viewKey} placement="bottom" />}
    </>
  );
}

export function SiteAd({ placement }: { placement: Placement }) {
  const consent = useCookieConsent();
  const viewport = useSyncExternalStore(subscribeViewport, adViewport);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    function restoreVisit(event: PageTransitionEvent) {
      if (event.persisted) setDismissed(false);
    }
    window.addEventListener('pageshow', restoreVisit);
    return () => window.removeEventListener('pageshow', restoreVisit);
  }, []);

  if (!siteAdServingEnabled || consent.value !== 'granted' || dismissed) return null;

  const targetViewport = placement === 'bottom' ? 'standard' : 'wide';
  if (placement !== 'inline' && viewport !== targetViewport) return null;

  return <AdSenseUnit placement={placement} onClose={() => setDismissed(true)} />;
}

function AdSenseUnit({ placement, onClose }: { placement: Placement; onClose: () => void }) {
  const { t } = usePreferences();
  const requested = useRef(false);
  useEffect(() => {
    if (requested.current) return;
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
  }, []);

  const bottom = placement === 'bottom';
  const size =
    placement === 'inline' ? { width: 'min(100%, 320px)', height: 90 } : { width: 160, height: 600 };

  const unit = (
    <ins
      className="adsbygoogle"
      style={bottom ? { display: 'block' } : { display: 'block', ...size }}
      data-ad-client={publisher}
      data-ad-slot={slot}
      data-ad-format={bottom ? 'auto' : undefined}
      data-full-width-responsive={bottom ? 'false' : undefined}
    />
  );
  return (
    <div className={`site-ad site-ad--${placement}`}>
      <button
        className="site-ad-close"
        type="button"
        aria-label={t('closeAdvertisement')}
        onClick={onClose}
      >
        <span aria-hidden="true">×</span>
      </button>
      {unit}
    </div>
  );
}
