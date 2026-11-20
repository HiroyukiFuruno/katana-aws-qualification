import { useEffect, useRef } from 'react';
import { dashboardSettingsKey } from './guestSettings';

export function useExternalDashboardSettings(guest: boolean, changed: () => void) {
  const latest = useRef(changed);
  latest.current = changed;
  useEffect(() => {
    if (!guest) return;
    const listener = (event: StorageEvent) => {
      if (event.key === null || event.key === dashboardSettingsKey) latest.current();
    };
    window.addEventListener('storage', listener);
    return () => window.removeEventListener('storage', listener);
  }, [guest]);
}
