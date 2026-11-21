import type { usePreferences } from '../../preferences';
import type { DashboardWidget } from '../preferenceTypes';
import type { DashboardSummary } from '../summaryTypes';
import { dashboardCategoryLabel, dashboardCertificationLabel } from './format';
import type { DashboardStatRow } from './StatsTable';

export function dashboardGroupRows(
  widget: DashboardWidget,
  summary: DashboardSummary,
  label: (value: string) => string,
  t: ReturnType<typeof usePreferences>['t'],
): DashboardStatRow[] {
  const named = (rows: DashboardSummary['groups']['modes']) =>
    rows.map((row) => ({ id: row.key, label: label(row.key), stats: row }));
  switch (widget.kind) {
    case 'certifications':
      return summary.groups.certifications.map((row) => ({
        id: row.key,
        label: dashboardCertificationLabel(row.key),
        stats: row,
      }));
    case 'categories':
    case 'relationship':
      return summary.groups.categories.map((row) => ({
        id: JSON.stringify([row.certificationId, row.category, row.sourceVersion, row.questionRevision]),
        label: dashboardCategoryLabel(row, t),
        stats: row,
      }));
    case 'modes':
      return named(summary.groups.modes);
    case 'contexts':
      return named(summary.groups.contexts);
    case 'formats':
      return named(widget.dimension === 'polarity' ? summary.groups.polarities : summary.groups.formats);
    case 'revisions':
      return summary.groups.revisions.map((row) => ({
        id: JSON.stringify([row.sourceVersion, row.questionRevision]),
        label: t('dashboardRevisionLabel', {
          sourceVersion: row.sourceVersion,
          revision: row.questionRevision,
        }),
        stats: row,
      }));
    default:
      return [];
  }
}
