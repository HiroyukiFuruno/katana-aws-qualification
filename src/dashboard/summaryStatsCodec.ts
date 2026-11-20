import { dashboardNumber, dashboardRecord } from './codec';
import type { DashboardStats } from './statTypes';

export const dashboardStatFields = [
  'answered',
  'correct',
  'accuracy',
  'durationMs',
  'meanDurationMs',
] as const;
export function readDashboardStats(value: unknown, extra: readonly string[] = []): DashboardStats {
  const row = dashboardRecord(value, [...dashboardStatFields, ...extra]);
  const answered = dashboardNumber(row.answered);
  const correct = dashboardNumber(row.correct, answered);
  const durationMs = dashboardNumber(
    row.durationMs,
    Math.min(Number.MAX_SAFE_INTEGER, answered * 86400000),
  );
  const accuracy = row.accuracy === null ? null : dashboardNumber(row.accuracy, 1, false);
  const meanDurationMs =
    row.meanDurationMs === null ? null : dashboardNumber(row.meanDurationMs, 86400000, false);
  if (
    answered === 0
      ? accuracy !== null || meanDurationMs !== null
      : accuracy === null || meanDurationMs === null
  )
    throw new Error('Invalid dashboard empty statistics.');
  if (accuracy !== null && Math.abs(accuracy - correct / answered) > 1e-9)
    throw new Error('Invalid dashboard accuracy.');
  if (
    meanDurationMs !== null &&
    Math.abs(meanDurationMs - durationMs / answered) > Math.max(1e-9, Math.abs(meanDurationMs) * 1e-12)
  )
    throw new Error('Invalid dashboard duration mean.');
  return { answered, correct, accuracy, durationMs, meanDurationMs };
}

export function dashboardRows<T>(
  value: unknown,
  read: (item: unknown) => T,
  identity?: (item: T) => string,
) {
  if (!Array.isArray(value)) throw new Error('Dashboard rows must be an array.');
  const rows = value.map(read);
  if (identity && new Set(rows.map(identity)).size !== rows.length)
    throw new Error('Duplicate dashboard row identity.');
  return rows;
}

export function assertDashboardSum(total: DashboardStats, groups: DashboardStats[], partial = false) {
  for (const metric of ['answered', 'correct', 'durationMs'] as const) {
    const sum = groups.reduce((value, group) => value + group[metric], 0);
    if (partial ? sum > total[metric] : sum !== total[metric])
      throw new Error('Dashboard group totals differ.');
  }
}
