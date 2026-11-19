import { useEffect, useState, useSyncExternalStore } from 'react';
import { localePath } from './locales';
import { usePreferences } from './preferences';

const key = 'katana-aws:cookie-consent';
const event = 'katana-cookie-consent';
let current: string | null = null;
try {
  current = localStorage.getItem(key);
} catch {
  // 保存できない環境でも現在のページには選択を反映する。
}
function subscribe(callback: () => void) {
  window.addEventListener(event, callback);
  return () => window.removeEventListener(event, callback);
}
export function useCookieConsent() {
  return useSyncExternalStore(subscribe, () => current);
}
export function cookiesAllowed() {
  return current === 'granted';
}
export function openCookieSettings() {
  window.dispatchEvent(new Event('katana-cookie-settings'));
}
export function clearAnalyticsCookies() {
  for (const cookie of ['_ga', '_ga_XS97G1267H']) {
    // biome-ignore lint/suspicious/noDocumentCookie: Synchronously clear the existing GA4 cookie on opt-out.
    document.cookie = `${cookie}=; Max-Age=0; Path=/`;
    // biome-ignore lint/suspicious/noDocumentCookie: Also clear the domain-scoped GA4 cookie.
    document.cookie = `${cookie}=; Max-Age=0; Path=/; Domain=${location.hostname}`;
  }
}
function saveChoice(value: string) {
  const revoke = cookiesAllowed() && value !== 'granted';
  current = value;
  try {
    localStorage.setItem(key, value);
    localStorage.setItem('katana-aws:analytics-consent', value);
  } catch {
    // 保存できない環境では次回訪問時に再確認する。
  }
  if (value !== 'granted') clearAnalyticsCookies();
  window.dispatchEvent(new Event(event));
  // 読み込み済みの広告スクリプトも停止するためページを更新する。
  if (revoke) location.reload();
}
export function CookieConsent() {
  const { t, locale } = usePreferences();
  const consent = useCookieConsent();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener('katana-cookie-settings', show);
    return () => window.removeEventListener('katana-cookie-settings', show);
  }, []);
  if (!open && (consent === 'granted' || consent === 'denied')) return null;
  function choose(value: string) {
    saveChoice(value);
    setOpen(false);
  }
  return (
    <section className="cookie-banner" aria-label={t('cookieTitle')}>
      <h2>{t('cookieTitle')}</h2>
      <p>
        {t('cookieDescription')} <a href={localePath(locale, 'privacy')}>{t('privacy')}</a>
      </p>
      <div className="cookie-actions">
        <button type="button" onClick={() => choose('denied')}>
          {t('cookieNecessary')}
        </button>
        <button type="button" onClick={() => choose('granted')}>
          {t('cookieAccept')}
        </button>
      </div>
    </section>
  );
}
