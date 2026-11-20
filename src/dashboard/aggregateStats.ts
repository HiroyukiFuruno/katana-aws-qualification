import type { DashboardEvent } from './eventTypes';
import type { DashboardDuration, DashboardStats } from './statTypes';

export function dashboardStats(events: readonly DashboardEvent[]): DashboardStats {
  const answered = events.length;
  const correct = events.filter((event) => event.isCorrect).length;
  const durationMs = events.reduce((total, event) => total + event.durationMs, 0);
  return {
    answered,
    correct,
    durationMs,
    accuracy: answered ? correct / answered : null,
    meanDurationMs: answered ? durationMs / answered : null,
  };
}

export function dashboardGroups<T>(
  events: readonly DashboardEvent[],
  identity: (event: DashboardEvent) => T,
) {
  const groups = new Map<string, { identity: T; events: DashboardEvent[] }>();
  for (const event of events) {
    const value = identity(event);
    const key = JSON.stringify(value);
    const group = groups.get(key) ?? { identity: value, events: [] };
    group.events.push(event);
    groups.set(key, group);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, group]) => ({ ...group.identity, ...dashboardStats(group.events) }));
}

export const dashboardDurationBounds = [0, 1000, 5000, 10000, 30000, 60000, 120000, 300000] as const;

export function dashboardDuration(events: readonly DashboardEvent[]): DashboardDuration {
  const values = events.map((event) => event.durationMs).sort((a, b) => a - b);
  const percentile = (fraction: number) => {
    if (!values.length) return null;
    const index = (values.length - 1) * fraction;
    const lower = Math.floor(index);
    return values[lower] + (values[Math.ceil(index)] - values[lower]) * (index - lower);
  };
  return {
    count: values.length,
    min: values.at(0) ?? null,
    p05: percentile(0.05),
    p25: percentile(0.25),
    p50: percentile(0.5),
    p75: percentile(0.75),
    p95: percentile(0.95),
    max: values.at(-1) ?? null,
    bins: dashboardDurationBounds.map((lowerMs, index) => {
      const upperMs = dashboardDurationBounds[index + 1] ?? null;
      return {
        lowerMs,
        upperMs,
        count: values.filter((value) => value >= lowerMs && (upperMs === null || value < upperMs))
          .length,
      };
    }),
  };
}
