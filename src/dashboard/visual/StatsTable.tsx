import { usePreferences } from '../../preferences';
import type { DashboardMetric } from '../preferenceTypes';
import type { DashboardStats } from '../statTypes';
import { metricKeys } from '../ui/dashboardLabels';
import { DashboardDataTable } from './DataTable';
import { dashboardMetricValue, formatDashboardValue } from './format';

export type DashboardStatRow = { id: string; label: string; stats: DashboardStats };
export function StatsTable({ rows, caption }: { rows: readonly DashboardStatRow[]; caption: string }) {
  const { locale, t } = usePreferences();
  const metrics: DashboardMetric[] = [
    'answered',
    'correct',
    'incorrect',
    'accuracy',
    'durationMs',
    'meanDurationMs',
  ];
  return (
    <DashboardDataTable
      caption={caption}
      columns={[
        { id: 'label', label: t('dashboardGroup') },
        ...metrics.map((metric) => ({ id: metric, label: t(metricKeys[metric]), numeric: true })),
      ]}
      rows={rows.map((row) => ({
        id: row.id,
        cells: {
          label: row.label,
          ...Object.fromEntries(
            metrics.map((metric) => [
              metric,
              formatDashboardValue(
                dashboardMetricValue(row.stats, metric),
                metric,
                locale,
                t('dashboardNotMeasured'),
              ),
            ]),
          ),
        },
      }))}
    />
  );
}
