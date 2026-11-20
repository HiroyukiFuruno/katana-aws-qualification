import {
  dashboardEnum,
  dashboardNumber,
  dashboardRecord,
  dashboardSelection,
  dashboardText,
  dashboardTimezone,
} from './codec';
import type { DashboardDimensions, DashboardFilters } from './queryTypes';

export const dashboardDimensionKeys = [
  'certificationIds',
  'categories',
  'modes',
  'contexts',
  'formats',
  'polarities',
  'revisions',
  'unitIds',
] as const;
export const dashboardFilterKeys = ['period', 'timezone', ...dashboardDimensionKeys] as const;
export const dashboardModes = ['study', 'review', 'exam'] as const;
export const dashboardContexts = ['practice', 'exam', 'lesson-checkpoint', 'lesson-final'] as const;
export const dashboardFormats = [
  'choice-single',
  'choice-multiple',
  'ordering',
  'matching',
  'unknown',
] as const;
export const dashboardPolarities = ['correct', 'incorrect', 'unspecified'] as const;

function readRevision(value: unknown) {
  const row = dashboardRecord(value, ['sourceVersion', 'questionRevision']);
  const questionRevision = dashboardNumber(row.questionRevision, 2147483647);
  if (questionRevision === 0) throw new Error('Dashboard revision must be positive.');
  return { sourceVersion: dashboardText(row.sourceVersion, 128), questionRevision };
}

export function readDashboardDimensions(row: Record<string, unknown>): DashboardDimensions {
  return {
    certificationIds: dashboardSelection(row.certificationIds, (value) => dashboardText(value, 120)),
    categories: dashboardSelection(row.categories, (value) => dashboardText(value)),
    modes: dashboardSelection(row.modes, (value) => dashboardEnum(value, dashboardModes)),
    contexts: dashboardSelection(row.contexts, (value) => dashboardEnum(value, dashboardContexts)),
    formats: dashboardSelection(row.formats, (value) => dashboardEnum(value, dashboardFormats)),
    polarities: dashboardSelection(row.polarities, (value) => dashboardEnum(value, dashboardPolarities)),
    revisions: dashboardSelection(row.revisions, readRevision),
    unitIds: dashboardSelection(row.unitIds, (value) => dashboardText(value, 120)),
  };
}

export function readDashboardFilters(value: unknown): DashboardFilters {
  const row = dashboardRecord(value, dashboardFilterKeys);
  return {
    period: dashboardEnum(row.period, ['7d', '30d', '90d', 'all']),
    timezone: dashboardTimezone(row.timezone),
    ...readDashboardDimensions(row),
  };
}

export function readDashboardOverrides(value: unknown): Partial<DashboardFilters> {
  const row = dashboardRecord(value, [], dashboardFilterKeys);
  const all = readDashboardFilters({
    period: '30d',
    timezone: 'UTC',
    ...Object.fromEntries(dashboardDimensionKeys.map((key) => [key, null])),
    ...row,
  });
  return Object.fromEntries(Object.entries(all).filter(([key]) => Object.hasOwn(row, key)));
}
