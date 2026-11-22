import { useMemo } from 'react';
import { usePreferences } from '../preferences';
import { useMilestoneLabels } from './labels';
import { agendaDate } from './presentationTypes';
import type { Milestone } from './types';

type Props = {
  items: readonly Milestone[];
  timeZone: string;
  month: Date;
  onMonth: (month: Date) => void;
};

export function MilestoneCalendar({ items, timeZone, month, onMonth }: Props) {
  const labels = useMilestoneLabels();
  const { locale } = usePreferences();
  const first = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1));
  const start = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();
  const cells = useMemo(() => Array.from({ length: 42 }, (_, index) => index - start + 1), [start]);
  const byDate = new Map<string, Milestone[]>();
  items.forEach((row) => {
    const date = agendaDate(row, timeZone);
    byDate.set(date, [...(byDate.get(date) ?? []), row]);
  });
  const monthName = new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  }).format(first);
  return (
    <section className="milestone-calendar">
      <div className="milestone-calendar-heading">
        <button
          type="button"
          aria-label={labels.t('milestonePreviousMonth')}
          onClick={() => onMonth(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() - 1, 1)))}
        >
          ‹
        </button>
        <h3>{monthName}</h3>
        <button
          type="button"
          aria-label={labels.t('milestoneNextMonth')}
          onClick={() => onMonth(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1)))}
        >
          ›
        </button>
      </div>
      <table className="milestone-calendar-grid">
        <thead>
          <tr>
            {Array.from({ length: 7 }, (_, day) => {
              const date = new Date(Date.UTC(2024, 0, 1 + day));
              return (
                <th key={date.toISOString()} scope="col">
                  {new Intl.DateTimeFormat(locale, { timeZone: 'UTC', weekday: 'short' }).format(date)}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 6 }, (_, week) => cells.slice(week * 7, week * 7 + 7)).map(
            (daysInWeek) => (
              <tr key={daysInWeek[0]}>
                {daysInWeek.map((day) => {
                  const date =
                    day > 0 && day <= days
                      ? `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                      : '';
                  return (
                    <td
                      className={date ? 'milestone-calendar-cell' : 'milestone-calendar-cell is-empty'}
                      key={day}
                    >
                      {date && (
                        <>
                          <time dateTime={date}>{day}</time>
                          {(byDate.get(date) ?? []).map((row) => (
                            <span className={`milestone-dot milestone-kind-${row.kind}`} key={row.id}>
                              {labels[row.kind]}
                            </span>
                          ))}
                        </>
                      )}
                    </td>
                  );
                })}
              </tr>
            ),
          )}
        </tbody>
      </table>
    </section>
  );
}
