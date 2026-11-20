import { useMemo, useSyncExternalStore } from 'react';
import { localePath, locales } from '../../locales';
import { lessonRouteAt } from './navigation';

function subscribe(listener: () => void) {
  window.addEventListener('popstate', listener);
  return () => window.removeEventListener('popstate', listener);
}

function snapshot() {
  return location.pathname + location.search + location.hash;
}

export function useLessonLocation() {
  const path = useSyncExternalStore(subscribe, snapshot);
  return useMemo(() => new URL(path, location.origin), [path]);
}

export function navigateLesson(path: string, replace = false) {
  const target = new URL(path, location.origin);
  const catalog = locales.some((locale) => target.pathname === localePath(locale, 'study/fundamentals'));
  if (
    target.origin !== location.origin ||
    target.hash ||
    (catalog && target.search) ||
    (!catalog && !lessonRouteAt(target.pathname, target.search))
  ) {
    throw new Error('Invalid lesson navigation.');
  }
  const href = target.pathname + target.search;
  if (href === location.pathname + location.search && !location.hash) return;
  window.dispatchEvent(new CustomEvent('kaq:lesson-navigation', { detail: href }));
  history[replace ? 'replaceState' : 'pushState'](null, '', href);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
