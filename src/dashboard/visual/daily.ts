import { dashboardDateLabel } from '../eventScope';
import type { DashboardQuery } from '../queryTypes';
import type { DashboardDailyStats } from '../statTypes';

export function dashboardCalendarDays(daily: readonly DashboardDailyStats[], query: DashboardQuery) {
  const end = dashboardDateLabel(
    new Date(Date.parse(query.range.to) - 1).toISOString(),
    query.range.timezone,
  );
  const start =
    query.range.from === null
      ? ([...daily].map((row) => row.date).sort()[0] ?? end)
      : dashboardDateLabel(query.range.from, query.range.timezone);
  const values = new Map(daily.map((row) => [row.date, row]));
  const rows: DashboardDailyStats[] = [];
  for (
    let time = Date.parse(`${start}T00:00:00Z`);
    time <= Date.parse(`${end}T00:00:00Z`);
    time += 86400000
  ) {
    const date = new Date(time).toISOString().slice(0, 10);
    rows.push(
      values.get(date) ?? {
        date,
        answered: 0,
        correct: 0,
        accuracy: null,
        durationMs: 0,
        meanDurationMs: null,
      },
    );
  }
  return rows;
}
