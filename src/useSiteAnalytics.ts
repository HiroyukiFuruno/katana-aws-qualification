import { useEffect } from 'react';
import { initializeAnalytics } from './AnalyticsSettings';
import { analyticsAllowedForPath } from './analyticsNavigation';

export function useSiteAnalytics(pathname: string, consent: boolean) {
  useEffect(() => {
    initializeAnalytics(analyticsAllowedForPath(pathname, consent));
  }, [pathname, consent]);
  useEffect(() => {
    const beforeNavigation = (event: Event) => {
      if (!(event instanceof CustomEvent) || typeof event.detail !== 'string') return;
      initializeAnalytics(
        analyticsAllowedForPath(new URL(event.detail, location.origin).pathname, consent),
      );
    };
    const beforeHistory = () => initializeAnalytics(analyticsAllowedForPath(location.pathname, consent));
    window.addEventListener('kaq:lesson-navigation', beforeNavigation);
    window.addEventListener('popstate', beforeHistory, true);
    return () => {
      window.removeEventListener('kaq:lesson-navigation', beforeNavigation);
      window.removeEventListener('popstate', beforeHistory, true);
    };
  }, [consent]);
}
