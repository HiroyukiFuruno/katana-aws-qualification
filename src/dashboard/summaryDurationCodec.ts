import { dashboardDurationBounds } from './aggregateStats';
import { dashboardNumber, dashboardRecord } from './codec';
import type { DashboardDuration } from './statTypes';
import { dashboardRows } from './summaryStatsCodec';

export function readDashboardDuration(value: unknown, answered: number): DashboardDuration {
  const row = dashboardRecord(value, ['count', 'min', 'p05', 'p25', 'p50', 'p75', 'p95', 'max', 'bins']);
  const count = dashboardNumber(row.count);
  if (count !== answered) throw new Error('Dashboard duration count differs.');
  const read = (value: unknown) => (value === null ? null : dashboardNumber(value, 86400000, false));
  const min = read(row.min),
    p05 = read(row.p05),
    p25 = read(row.p25),
    p50 = read(row.p50),
    p75 = read(row.p75),
    p95 = read(row.p95),
    max = read(row.max);
  const points = [min, p05, p25, p50, p75, p95, max];
  if (
    points.some((point) => (count === 0 ? point !== null : point === null)) ||
    points.some((point, index) => index > 0 && point !== null && point < (points[index - 1] ?? 0))
  )
    throw new Error('Invalid dashboard duration quantiles.');
  const bins = dashboardRows(row.bins, (value) => {
    const bin = dashboardRecord(value, ['lowerMs', 'upperMs', 'count']);
    return {
      lowerMs: dashboardNumber(bin.lowerMs),
      upperMs: bin.upperMs === null ? null : dashboardNumber(bin.upperMs),
      count: dashboardNumber(bin.count),
    };
  });
  if (
    bins.length !== dashboardDurationBounds.length ||
    bins.some(
      (bin, index) =>
        bin.lowerMs !== dashboardDurationBounds[index] ||
        bin.upperMs !== (dashboardDurationBounds[index + 1] ?? null),
    ) ||
    bins.reduce((sum, bin) => sum + bin.count, 0) !== count
  )
    throw new Error('Invalid dashboard duration histogram.');
  return { count, min, p05, p25, p50, p75, p95, max, bins };
}
