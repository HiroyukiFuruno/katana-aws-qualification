import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { type Locale, localeForPath, localePath, locales } from './locales';
import { type Message, messages } from './messages';
import { routeAt } from './routes';
import { guestLocaleKey, writeGuestPreference } from './sitePreferences/browserStorage';
import { useSitePreferences } from './sitePreferences/context';
import type { SitePreferences } from './sitePreferences/repository';
import { useSiteTheme } from './sitePreferences/useTheme';

type Translation = (key: Message, values?: Record<string, string | number>) => string;
const Preferences = createContext<{
  locale: Locale;
  t: Translation;
  changeLocale: (locale: Locale) => void;
  theme: 'light' | 'dark';
  themeChoice: SitePreferences['theme'];
  changeTheme(theme: SitePreferences['theme']): void;
}>({
  locale: 'en',
  t: (key) => messages.en[key],
  changeLocale() {},
  theme: 'light',
  themeChoice: null,
  changeTheme() {},
});

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const site = useSitePreferences();
  const theme = useSiteTheme();
  const [locale, setLocale] = useState(
    () => routeAt(location.pathname)?.locale ?? localeForPath(location.pathname),
  );
  useEffect(() => {
    const onPopState = () =>
      setLocale(routeAt(location.pathname)?.locale ?? localeForPath(location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const navigateLocale = useCallback(
    (next: Locale) => {
      if (next === locale) return;
      const path = localePath(next, routeAt(location.pathname)?.page);
      const localizedPath = routeAt(path)
        ? path + location.search + location.hash
        : localePath(next, 'study/questions');
      history.pushState(null, '', localizedPath);
      setLocale(next);
    },
    [locale],
  );

  useEffect(() => {
    const preferred = site.values.locale;
    if (
      site.kind === 'member' &&
      !site.loading &&
      preferred &&
      routeAt(location.pathname)?.page === 'dashboard'
    )
      navigateLocale(preferred);
  }, [site.kind, site.loading, site.values.locale, navigateLocale]);

  function changeLocale(next: Locale) {
    if (site.disabled) return;
    navigateLocale(next);
    if (site.kind === 'member') site.save({ ...site.values, locale: next });
    else if (site.kind === 'guest') writeGuestPreference(guestLocaleKey, next);
  }

  const t: Translation = (key, values = {}) => {
    return messages[locale][key].replace(/\{(\w+)\}/g, (match, name: string) =>
      Object.hasOwn(values, name) ? String(values[name]) : match,
    );
  };

  return (
    <Preferences.Provider value={{ locale, changeLocale, t, ...theme }}>{children}</Preferences.Provider>
  );
}

export const usePreferences = () => useContext(Preferences);

export function SiteControls() {
  const { locale, changeLocale, t, theme, changeTheme } = usePreferences();
  const site = useSitePreferences();

  return (
    <div className="site-controls">
      <label className="sr-only" htmlFor="site-locale">
        {t('language')}
      </label>
      <select
        id="site-locale"
        value={locale}
        disabled={site.disabled}
        onChange={(event) => {
          const selected = locales.find((candidate) => candidate === event.currentTarget.value);
          if (selected) changeLocale(selected);
        }}
      >
        {locales.map((value) => (
          <option key={value} value={value} lang={value}>
            {messages[value].localeName}
          </option>
        ))}
      </select>
      <button
        type="button"
        aria-label={t('darkMode')}
        title={t('darkMode')}
        aria-pressed={theme === 'dark'}
        disabled={site.disabled}
        aria-busy={site.notice === 'saving'}
        onClick={() => changeTheme(theme === 'dark' ? 'light' : 'dark')}
      >
        {theme === 'dark' ? '☾' : '☀'}
      </button>
    </div>
  );
}
