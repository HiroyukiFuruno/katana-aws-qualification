import { useEffect, useState } from 'react';
import { guestThemeKey, readGuestPreference, writeGuestPreference } from './browserStorage';
import { useSitePreferences } from './context';
import type { SitePreferences } from './repository';

const darkPreference = '(prefers-color-scheme: dark)';

export function useSiteTheme() {
  const site = useSitePreferences();
  const [guestTheme, setGuestTheme] = useState<SitePreferences['theme']>(() => {
    const saved = readGuestPreference(guestThemeKey);
    return saved === 'light' || saved === 'dark' ? saved : null;
  });
  const [systemDark, setSystemDark] = useState(() => matchMedia(darkPreference).matches);
  const themeChoice = site.kind === 'member' ? site.values.theme : guestTheme;
  const theme = themeChoice ?? (systemDark ? 'dark' : 'light');
  useEffect(() => {
    const media = matchMedia(darkPreference);
    const update = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  function changeTheme(next: SitePreferences['theme']) {
    if (site.disabled) return;
    if (site.kind === 'member') site.save({ ...site.values, theme: next });
    else if (site.kind === 'guest') {
      setGuestTheme(next);
      writeGuestPreference(guestThemeKey, next);
    }
  }
  return { theme, themeChoice, changeTheme };
}
