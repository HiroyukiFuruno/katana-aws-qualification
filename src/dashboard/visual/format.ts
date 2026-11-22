import type { Locale } from '../../locales';
import type { DashboardMetric } from '../preferenceTypes';
import type { DashboardStats } from '../statTypes';

export function dashboardMetricValue(stats: DashboardStats, metric: DashboardMetric) {
  if (metric === 'incorrect') return stats.answered - stats.correct;
  if (metric === 'accuracy') return stats.accuracy === null ? null : stats.accuracy * 100;
  return stats[metric];
}
export function formatDashboardValue(
  value: number | null,
  metric: DashboardMetric,
  locale: Locale,
  unknown: string,
) {
  if (value === null) return unknown;
  if (metric === 'accuracy')
    return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(
      value / 100,
    );
  if (metric === 'durationMs' || metric === 'meanDurationMs')
    return new Intl.NumberFormat(locale, {
      style: 'unit',
      unit: 'second',
      unitDisplay: 'short',
      maximumFractionDigits: 2,
    }).format(value / 1000);
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
}
