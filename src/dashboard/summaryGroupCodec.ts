import { dashboardNumber, dashboardRecord, dashboardText } from './codec';
import { dashboardRows, dashboardStatFields, readDashboardStats } from './summaryStatsCodec';
import type { DashboardSummary } from './summaryTypes';

function group(value: unknown, keys: readonly string[]) {
  return {
    row: dashboardRecord(value, [...dashboardStatFields, ...keys]),
    stats: readDashboardStats(value, keys),
  };
}
export function dashboardRevisionNumber(value: unknown) {
  const revision = dashboardNumber(value, 2147483647);
  if (revision === 0) throw new Error('Invalid dashboard revision.');
  return revision;
}
export function dashboardDate(value: unknown) {
  const date = dashboardText(value, 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date
  )
    throw new Error('Invalid dashboard calendar date.');
  return date;
}
export function readDashboardDaily(value: unknown) {
  return dashboardRows(
    value,
    (item) => {
      const { row, stats } = group(item, ['date']);
      return { date: dashboardDate(row.date), ...stats };
    },
    (item) => item.date,
  );
}
export function readDashboardGroups(value: unknown): DashboardSummary['groups'] {
  const row = dashboardRecord(value, [
    'certifications',
    'categories',
    'modes',
    'contexts',
    'formats',
    'polarities',
    'revisions',
    'units',
  ]);
  const named = (value: unknown) =>
    dashboardRows(
      value,
      (item) => {
        const { row, stats } = group(item, ['key']);
        return { key: dashboardText(row.key), ...stats };
      },
      (item) => item.key,
    );
  return {
    certifications: named(row.certifications),
    modes: named(row.modes),
    contexts: named(row.contexts),
    formats: named(row.formats),
    polarities: named(row.polarities),
    categories: dashboardRows(
      row.categories,
      (item) => {
        const { row, stats } = group(item, [
          'certificationId',
          'category',
          'sourceVersion',
          'questionRevision',
        ]);
        return {
          certificationId: dashboardText(row.certificationId, 120),
          category: dashboardText(row.category),
          sourceVersion: dashboardText(row.sourceVersion, 128),
          questionRevision: dashboardRevisionNumber(row.questionRevision),
          ...stats,
        };
      },
      (item) =>
        JSON.stringify([item.certificationId, item.category, item.sourceVersion, item.questionRevision]),
    ),
    revisions: dashboardRows(
      row.revisions,
      (item) => {
        const { row, stats } = group(item, ['sourceVersion', 'questionRevision']);
        return {
          sourceVersion: dashboardText(row.sourceVersion, 128),
          questionRevision: dashboardRevisionNumber(row.questionRevision),
          ...stats,
        };
      },
      (item) => JSON.stringify([item.sourceVersion, item.questionRevision]),
    ),
    units: dashboardRows(
      row.units,
      (item) => {
        const { row, stats } = group(item, ['unitId', 'contentVersion']);
        return {
          unitId: dashboardText(row.unitId, 120),
          contentVersion: dashboardText(row.contentVersion, 128),
          ...stats,
        };
      },
      (item) => JSON.stringify([item.unitId, item.contentVersion]),
    ),
  };
}
