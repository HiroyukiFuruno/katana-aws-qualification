import type { DashboardFacets } from '../summaryTypes';
import type { DashboardLessonData } from '../viewTypes';

export function dashboardDisplayFacets(
  facets: DashboardFacets | undefined,
  lessons: readonly DashboardLessonData[],
): DashboardFacets {
  const base: DashboardFacets = facets ?? {
    certificationIds: [],
    categories: [],
    modes: [],
    contexts: [],
    formats: [],
    polarities: [],
    revisions: [],
    units: [],
  };
  const units = new Map(base.units.map((unit) => [unit.unitId, unit]));
  for (const lesson of lessons)
    if (!units.has(lesson.unitId))
      units.set(lesson.unitId, { unitId: lesson.unitId, contentVersion: lesson.summary.contentVersion });
  return { ...base, units: [...units.values()] };
}
