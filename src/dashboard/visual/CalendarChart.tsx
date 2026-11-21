import { useState } from 'react';
import { usePreferences } from '../../preferences';
import type { DashboardMetric } from '../preferenceTypes';
import type { DashboardQuery } from '../queryTypes';
import type { DashboardDailyStats } from '../statTypes';
import { chartDomain } from './geometry';

function monthsBetween(from: string, to: string) {
  const result: string[] = [];
  let year = Number(from.slice(0, 4)),
    month = Number(from.slice(5, 7));
  const last = Number(to.slice(0, 4)) * 12 + Number(to.slice(5, 7));
  while (year * 12 + month <= last) {
    result.push(`${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`);
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }
  return result;
}
export function CalendarChart({
  daily,
  query,
  metric,
  label,
}: {
  daily: readonly DashboardDailyStats[];
  query: DashboardQuery;
  metric: DashboardMetric;
  label: string;
}) {
  const { locale, t } = usePreferences();
  const dates = [...daily].sort((a, b) => a.date.localeCompare(b.date));
  const dateLabel = (time: number) =>
    new Intl.DateTimeFormat('sv-SE', { timeZone: query.range.timezone }).format(time);
  const latest = dateLabel(Date.parse(query.range.to) - 1);
  const first =
    query.range.from === null ? (dates[0]?.date ?? latest) : dateLabel(Date.parse(query.range.from));
  const months = monthsBetween(first, latest);
  const [selected, setSelected] = useState<string | null>(null);
  const month =
    selected !== null && months.includes(selected) ? selected : (months.at(-1) ?? latest.slice(0, 7));
  const start = new Date(`${month}-01T00:00:00Z`);
  const offset = (start.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();
  const maximum = chartDomain(
    daily.map((day) => (metric === 'durationMs' ? day.durationMs : day.answered)),
  );
  const byDate = new Map(daily.map((day) => [day.date, day]));
  return (
    <div className="dashboard-viz-calendar">
      <label>
        {t('dashboardCalendarMonth')}
        <select value={month} onChange={(event) => setSelected(event.currentTarget.value)}>
          {months.map((month) => (
            <option key={month} value={month}>
              {new Intl.DateTimeFormat(locale, {
                year: 'numeric',
                month: 'long',
                timeZone: 'UTC',
              }).format(new Date(`${month}-01T00:00:00Z`))}
            </option>
          ))}
        </select>
      </label>
      <div className="dashboard-viz-calendar-grid" role="img" aria-label={label}>
        {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((weekday, index) => (
          <span className="dashboard-viz-weekday" key={weekday}>
            {new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(
              new Date(Date.UTC(2026, 0, 5 + index)),
            )}
          </span>
        ))}
        {Array.from({ length: offset }, (_, index) =>
          new Date(start.getTime() - (offset - index) * 86400000).toISOString(),
        ).map((date) => (
          <span key={date} />
        ))}
        {Array.from({ length: count }, (_, index) => {
          const date = `${month}-${String(index + 1).padStart(2, '0')}`;
          const value = byDate.get(date);
          const amount = metric === 'durationMs' ? (value?.durationMs ?? 0) : (value?.answered ?? 0);
          const outside = date < first || date > latest;
          return (
            <span
              key={date}
              className={`dashboard-viz-day${outside ? ' dashboard-viz-outside' : ''}`}
              style={
                outside
                  ? undefined
                  : {
                      background: `color-mix(in srgb, var(--viz-primary) ${amount ? 20 + (amount / maximum) * 65 : 0}%, var(--paper))`,
                    }
              }
              title={`${date}: ${amount}`}
            >
              <span>{index + 1}</span>
              {!outside && (
                <strong>
                  {metric === 'durationMs'
                    ? t('dashboardDurationSeconds', { seconds: Math.round(amount / 1000) })
                    : amount}
                </strong>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}
