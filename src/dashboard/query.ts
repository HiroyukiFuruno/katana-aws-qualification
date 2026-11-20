import { timestamp } from '../fundamentals/state/codecPrimitives';
import { dashboardRecord, dashboardTimezone } from './codec';
import { dashboardDimensionKeys, readDashboardDimensions, readDashboardFilters } from './filterCodec';
import type { DashboardFilters, DashboardQuery } from './queryTypes';

const dayMs = 86400000;

function localDay(time: number, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(time);
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value);
  return Date.UTC(part('year'), part('month') - 1, part('day'));
}

function localMidnight(day: number, timezone: string) {
  // 暦日の最初の瞬間を探すため、夏時間を固定24時間の差へ置換しない。
  let lower = day - 2 * dayMs;
  let upper = day + 2 * dayMs;
  while (lower < upper) {
    const middle = Math.floor((lower + upper) / 2);
    if (localDay(middle, timezone) < day) lower = middle + 1;
    else upper = middle;
  }
  return lower;
}

export function readDashboardQuery(value: unknown): DashboardQuery {
  const row = dashboardRecord(value, ['range', ...dashboardDimensionKeys]);
  const range = dashboardRecord(row.range, ['from', 'to', 'timezone']);
  const from = range.from === null ? null : timestamp(range.from, 'dashboard.from');
  const to = timestamp(range.to, 'dashboard.to');
  if (from !== null && Date.parse(from) >= Date.parse(to)) throw new Error('Empty dashboard range.');
  return {
    range: { from, to, timezone: dashboardTimezone(range.timezone) },
    ...readDashboardDimensions(row),
  };
}

export function buildDashboardQuery(value: DashboardFilters, asOf: number): DashboardQuery {
  const { period, timezone, ...dimensions } = readDashboardFilters(value);
  if (!Number.isSafeInteger(asOf) || asOf < 0) throw new Error('Invalid dashboard query clock.');
  const days = period === 'all' ? null : Number(period.slice(0, -1));
  const from =
    days === null
      ? null
      : new Date(localMidnight(localDay(asOf, timezone) - (days - 1) * dayMs, timezone)).toISOString();
  return { ...dimensions, range: { from, to: new Date(asOf + 1).toISOString(), timezone } };
}

export function dashboardQueryKey(query: DashboardQuery) {
  return JSON.stringify(readDashboardQuery(query));
}
