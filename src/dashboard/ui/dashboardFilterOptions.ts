import { certifications } from '../../certifications';
import type { DashboardFilters } from '../queryTypes';
import type { DashboardFacets } from '../summaryTypes';

export const fixedFilterValues = {
  modes: ['study', 'review', 'exam'],
  contexts: ['practice', 'exam', 'lesson-checkpoint', 'lesson-final'],
  formats: ['choice-single', 'choice-multiple', 'ordering', 'matching', 'unknown'],
  polarities: ['correct', 'incorrect', 'unspecified'],
} as const;
const unique = (values: readonly string[]) => [...new Set(values)];
const currentValues = (value: unknown) =>
  Array.isArray(value)
    ? value.map((item) => (typeof item === 'string' ? item : JSON.stringify(item)))
    : [];
export function dashboardFilterOptions(facets: DashboardFacets | undefined, current: DashboardFilters) {
  const certificationIds = unique([
    'fundamentals',
    ...certifications.map((item) => item.id),
    ...(facets?.certificationIds ?? []),
    ...(current.certificationIds ?? []),
  ]);
  const categoryValues = certifications.flatMap((item) =>
    Object.keys(item.course?.exam.distribution ?? {}).map((category) => category),
  );
  const categories = unique([
    ...categoryValues,
    ...(facets?.categories.map((item) => item.category) ?? []),
    ...(current.categories ?? []),
  ]);
  const revisions = unique([
    ...(facets?.revisions.map((item) => JSON.stringify(item)) ?? []),
    ...currentValues(current.revisions),
  ]);
  const units = unique([
    ...(facets?.units.map((item) => item.unitId) ?? []),
    ...(current.unitIds ?? []),
  ]);
  return {
    certificationIds,
    categories,
    modes: unique([...fixedFilterValues.modes, ...(facets?.modes ?? []), ...(current.modes ?? [])]),
    contexts: unique([
      ...fixedFilterValues.contexts,
      ...(facets?.contexts ?? []),
      ...(current.contexts ?? []),
    ]),
    formats: unique([
      ...fixedFilterValues.formats,
      ...(facets?.formats ?? []),
      ...(current.formats ?? []),
    ]),
    polarities: unique([
      ...fixedFilterValues.polarities,
      ...(facets?.polarities ?? []),
      ...(current.polarities ?? []),
    ]),
    revisions,
    units,
  };
}
export function certificationLabel(id: string) {
  return certifications.find((item) => item.id === id)?.name ?? id;
}
