import { isPrivateLessonPage } from './fundamentals/delivery/routePages';
import { accountPages, routeAt } from './routes';

export function analyticsAllowedForPath(path: string, cookieGranted: boolean) {
  const route = routeAt(path);
  return Boolean(
    cookieGranted && route && !accountPages.includes(route.page) && !isPrivateLessonPage(route.page),
  );
}
