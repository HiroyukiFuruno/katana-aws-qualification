import { type ReactNode, useEffect, useRef, useSyncExternalStore } from 'react';

import { useCookieConsent } from './CookieConsent';
import { usePreferences } from './preferences';
import './site-ad.css';

const publisher = 'ca-pub-6906125453421012';
const slot = '1732021005';
export const siteAdServingEnabled = import.meta.env.PROD && import.meta.env.VITE_ADSENSE_SERVING === '1';

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

const adVisibilityKey = 'kaq:ads-collapsed';
const adVisibilityEvents = new EventTarget();
let adsCollapsed = false;
try {
  adsCollapsed = sessionStorage.getItem(adVisibilityKey) === '1';
} catch {
  // 保存できない環境でも現在のページでは選択を維持する。
}

function subscribeAdVisibility(onChange: () => void) {
  adVisibilityEvents.addEventListener('change', onChange);
  return () => adVisibilityEvents.removeEventListener('change', onChange);
}

export function useAdsCollapsed() {
  return useSyncExternalStore(subscribeAdVisibility, () => adsCollapsed);
}

export function SiteAdVisibilityButton() {
  const { t } = usePreferences();
  const consent = useCookieConsent();
  const collapsed = useAdsCollapsed();
  if (!siteAdServingEnabled || consent.value !== 'granted') return null;

  return (
    <button
      className="site-ad-visibility"
      type="button"
      onClick={() => {
        adsCollapsed = !collapsed;
        try {
          sessionStorage.setItem(adVisibilityKey, adsCollapsed ? '1' : '0');
        } catch {
          // 現在のページではメモリ上の選択を利用する。
        }
        adVisibilityEvents.dispatchEvent(new Event('change'));
      }}
    >
      {t(collapsed ? 'showAdvertisements' : 'collapseAdvertisements')}
    </button>
  );
}

type Placement = 'footer' | 'inline' | 'left' | 'right';

export function SiteAdLayout({ children, show }: { children: ReactNode; show: boolean }) {
  if (!show) return children;

  return (
    <div className="site-ad-layout">
      {children}
      <SiteAd placement="left" />
      <SiteAd placement="right" />
    </div>
  );
}

export function SiteAd({
  placement = 'footer',
  fullWidth = true,
  replaceOnMobile = false,
}: {
  placement?: Placement;
  fullWidth?: boolean;
  replaceOnMobile?: boolean;
}) {
  const consent = useCookieConsent();
  const viewport = useSyncExternalStore(subscribeViewport, adViewport);
  const collapsed = useAdsCollapsed();
  if (!siteAdServingEnabled || consent.value !== 'granted' || collapsed) return null;
  if (placement === 'inline' && viewport !== 'mobile') return null;
  if (placement === 'footer' && replaceOnMobile && viewport === 'mobile') return null;
  if ((placement === 'left' || placement === 'right') && viewport !== 'wide') return null;
  return <AdSenseUnit placement={placement} fullWidth={fullWidth} />;
}

function AdSenseUnit({ placement, fullWidth }: { placement: Placement; fullWidth: boolean }) {
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

  const footer = placement === 'footer';
  const size =
    placement === 'inline' ? { width: 'min(100%, 320px)', height: 90 } : { width: 160, height: 600 };

  const unit = (
    <ins
      className="adsbygoogle"
      style={footer ? { display: 'block', marginBlockStart: '1rem' } : { display: 'block', ...size }}
      data-ad-client={publisher}
      data-ad-slot={slot}
      data-ad-format={footer ? 'auto' : undefined}
      data-full-width-responsive={footer ? String(fullWidth) : undefined}
    />
  );
  if (footer) return unit;

  return (
    <div className={`site-ad site-ad--${placement}`}>
      <span className="site-ad-label">{t('advertisement')}</span>
      {unit}
    </div>
  );
}
