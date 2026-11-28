import { type Locale, localePath } from '../locales.ts';
import localized from './catalog.json' with { type: 'json' };
import type { StudyMetadata, StudyPrerequisite } from './types.ts';

const catalog: StudyMetadata = localized;
const pathFor = (courseId: string) => `study/${courseId}/learn`;

export const qualificationLearningPages = Object.entries(catalog.ja).flatMap(([courseId, course]) => [
  pathFor(courseId),
  ...Object.keys(course.units).map((unitId) => `${pathFor(courseId)}/${unitId}`),
]);

export function qualificationPrerequisitePath(locale: Locale, { slug, courseId }: StudyPrerequisite) {
  if (!courseId) return localePath(locale, `study/fundamentals/${slug}`);
  const root = pathFor(courseId);
  return localePath(locale, slug ? `${root}/${slug}` : root);
}

export function qualificationLearningPath(locale: Locale, courseId: string) {
  return catalog[locale][courseId] ? localePath(locale, pathFor(courseId)) : undefined;
}

export function qualificationLearningRoute(locale: Locale, page: string) {
  const parts = page.split('/');
  const [section, courseId, mode, unitId] = parts;
  if (section !== 'study' || mode !== 'learn' || parts.length > 4) return undefined;
  const course = catalog[locale][courseId];
  if (!course) return undefined;
  const unit = unitId ? course.units[unitId] : undefined;
  if (unitId && !unit) return undefined;
  return {
    page: pathFor(courseId),
    courseId,
    course,
    unitId,
    title: unit ? `${unit.title} | ${course.title}` : course.title,
    description: unit?.objective ?? course.description,
  };
}
