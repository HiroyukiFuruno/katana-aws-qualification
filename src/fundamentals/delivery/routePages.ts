import { type Locale, locales } from '../../locales.ts';
import type { DeliveryRouteManifest } from './artifactTypes';
import { type LessonRoute, lessonPath, lessonRouteAt } from './navigation.ts';
import manifest from './routeManifest.json' with { type: 'json' };
import history from './archivedRouteManifest.json' with { type: 'json' };

const routes = manifest as DeliveryRouteManifest;
type LessonPage = { locale: Locale; page: string; route: LessonRoute; title: string };

function unit(unitId: string) {
  const result = routes.units.find((item) => item.unitId === unitId);
  if (!result) throw new Error(`Unknown fundamentals unit: ${unitId}`);
  return result;
}

function entries(
  locale: Locale,
  privateOnly: boolean,
  edition: DeliveryRouteManifest = routes,
): LessonPage[] {
  return edition.units.flatMap((item) => {
    const result: LessonPage[] = [];
    const resume: LessonRoute = { locale, unitId: item.unitId, stage: 'resume' };
    if (!privateOnly)
      result.push({
        locale,
        page: lessonPath(resume).replace(`/${locale}`, '').replace(/^\//, '').replace(/\/$/, ''),
        route: resume,
        title: item.title,
      });
    for (const step of item.nonFinalSteps) {
      const route: LessonRoute = {
        locale,
        unitId: item.unitId,
        stage: step.kind === 'checkpoint' ? 'checkpoints' : 'slides',
        position: step.globalPosition,
      };
      if (!privateOnly)
        result.push({
          locale,
          page: lessonPath(route).replace(`/${locale}`, '').replace(/^\//, '').replace(/\/$/, ''),
          route,
          title: item.title,
        });
    }
    for (const final of item.finalQuestions) {
      const route: LessonRoute = {
        locale,
        unitId: item.unitId,
        stage: 'final',
        position: final.position,
      };
      if (privateOnly)
        result.push({
          locale,
          page: lessonPath(route).replace(`/${locale}`, '').replace(/^\//, '').replace(/\/$/, ''),
          route,
          title: item.title,
        });
    }
    const resultRoute: LessonRoute = { locale, unitId: item.unitId, stage: 'result' };
    if (privateOnly)
      result.push({
        locale,
        page: lessonPath(resultRoute).replace(`/${locale}`, '').replace(/^\//, '').replace(/\/$/, ''),
        route: resultRoute,
        title: item.title,
      });
    return result;
  });
}

export const publicLessonPages = locales.flatMap((locale) => entries(locale, false));
const currentPrivatePages = locales.flatMap((locale) => entries(locale, true));
const paths = new Set(
  [...publicLessonPages, ...currentPrivatePages].map((entry) => lessonPath(entry.route)),
);
const archivedPages = (history.editions as DeliveryRouteManifest[])
  .flatMap((edition) => locales.flatMap((locale) => entries(locale, false, edition)))
  .filter((entry) => {
    const path = lessonPath(entry.route);
    if (paths.has(path)) return false;
    paths.add(path);
    return true;
  });
export const privateLessonPages = [...currentPrivatePages, ...archivedPages];
export const publicLessonPageNames = [...new Set(publicLessonPages.map((item) => item.page))];
export const privateLessonPageNames = [...new Set(privateLessonPages.map((item) => item.page))];

const publicByPath = new Map(publicLessonPages.map((item) => [lessonPath(item.route), item]));
const privateByPath = new Map(privateLessonPages.map((item) => [lessonPath(item.route), item]));

export function lessonPageAt(path: string) {
  return (
    publicByPath.get(path.endsWith('/') ? path : `${path}/`) ??
    privateByPath.get(path.endsWith('/') ? path : `${path}/`)
  );
}

export function isPrivateLessonPage(page: string) {
  return privateLessonPageNames.includes(page);
}

export function lessonPageNamesFor(locale: Locale, visibility: 'public' | 'private') {
  return (visibility === 'public' ? publicLessonPages : privateLessonPages)
    .filter((item) => item.locale === locale)
    .map((item) => item.page);
}

export function titleForLessonPage(page: string) {
  const entry = [...publicLessonPages, ...privateLessonPages].find((item) => item.page === page);
  return entry?.title;
}

export function validateLessonRoute(path: string) {
  const parsed = lessonRouteAt(path);
  if (!parsed) return undefined;
  return lessonPageAt(path);
}

export function contentVersionForUnit(unitId: string) {
  return unit(unitId).contentVersion;
}

export { routes as deliveryRouteManifest };
