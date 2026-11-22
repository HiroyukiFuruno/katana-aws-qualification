import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import localeNames from './locale-names.json' with { type: 'json' };
import { type Locale, localeForPath, localePath, locales } from './locales';
import { formatQuantityMessage } from './locales/quantity';
import { type Message, messages } from './messages';
import { routeAt } from './routes';

const localeKey = 'katana-site-locale';
const themeKey = 'katana-site-theme';
const darkPreference = '(prefers-color-scheme: dark)';

function readPreference(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writePreference(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* The current selection still applies. */
  }
}

type Translation = (key: Message, values?: Record<string, string | number>) => string;
const Preferences = createContext<{
  locale: Locale;
  t: Translation;
  changeLocale: (locale: Locale) => void;
}>({
  locale: 'en',
  t: (key) => messages.en[key],
  changeLocale() {},
});

export function PreferencesProvider({ children }: { children: ReactNode }) {
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

  function changeLocale(next: Locale) {
    if (next === locale) return;
    const path = localePath(next, routeAt(location.pathname)?.page);
    const localizedPath = routeAt(path)
      ? path + location.search + location.hash
      : localePath(next, 'study/questions');
    history.pushState(null, '', localizedPath);
    writePreference(localeKey, next);
    setLocale(next);
  }

  const t: Translation = (key, values = {}) => {
    return formatQuantityMessage(locale, key, messages[locale][key], values).replace(
      /\{(\w+)\}/g,
      (match, name: string) => (Object.hasOwn(values, name) ? String(values[name]) : match),
    );
  };

  return <Preferences.Provider value={{ locale, changeLocale, t }}>{children}</Preferences.Provider>;
}

export const usePreferences = () => useContext(Preferences);

export function SiteControls() {
  const { locale, changeLocale, t } = usePreferences();
  const [theme, setTheme] = useState(() => {
    const saved = readPreference(themeKey);
    return saved === 'light' || saved === 'dark' ? saved : undefined;
  });
  const [systemDark, setSystemDark] = useState(() => matchMedia(darkPreference).matches);
  const current = theme ?? (systemDark ? 'dark' : 'light');

  useEffect(() => {
    const media = matchMedia(darkPreference);
    const update = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <div className="site-controls">
      <label className="sr-only" htmlFor="site-locale">
        {t('language')}
      </label>
      <select
        id="site-locale"
        value={locale}
        onChange={(event) => {
          const selected = locales.find((candidate) => candidate === event.currentTarget.value);
          if (selected) changeLocale(selected);
        }}
      >
        {locales.map((value) => (
          <option key={value} value={value} lang={value}>
            {localeNames[value]}
          </option>
        ))}
      </select>
      <button
        type="button"
        aria-label={t('darkMode')}
        title={t('darkMode')}
        aria-pressed={current === 'dark'}
        onClick={() => {
          const next = current === 'dark' ? 'light' : 'dark';
          setTheme(next);
          writePreference(themeKey, next);
        }}
      >
        {current === 'dark' ? '☾' : '☀'}
      </button>
    </div>
  );
}
