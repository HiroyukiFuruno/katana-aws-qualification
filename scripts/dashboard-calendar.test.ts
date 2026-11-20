import { expect, test } from 'bun:test';
import { dashboardDefaults } from '../src/dashboard/preferences';
import { buildDashboardQuery } from '../src/dashboard/query';
import { dashboardCalendarDays } from '../src/dashboard/visual/daily';

test('calendar includes zero activity days without inventing a zero accuracy measurement', () => {
  const query = buildDashboardQuery(
    { ...dashboardDefaults('Asia/Tokyo').filters, period: '7d' },
    Date.parse('2026-11-20T12:00:00Z'),
  );
  const days = dashboardCalendarDays(
    [{ date: '2026-11-18', answered: 1, correct: 1, accuracy: 1, durationMs: 0, meanDurationMs: 0 }],
    query,
  );
  expect(days).toHaveLength(7);
  expect(days[0].date).toBe('2026-11-14');
  expect(days[6].date).toBe('2026-11-20');
  expect(days[0]).toMatchObject({ answered: 0, accuracy: null, meanDurationMs: null });
  expect(days[4]).toMatchObject({ answered: 1, accuracy: 1, meanDurationMs: 0 });
});

test('timezone spelling is canonical for the database; no DST day is omitted', () => {
  const query = buildDashboardQuery(
    { ...dashboardDefaults('america/new_york').filters, period: '7d' },
    Date.parse('2026-03-09T12:00:00Z'),
  );
  expect(query.range.timezone).toBe('America/New_York');
  const days = dashboardCalendarDays([], query);
  expect(days.map((day) => day.date)).toEqual([
    '2026-03-03',
    '2026-03-04',
    '2026-03-05',
    '2026-03-06',
    '2026-03-07',
    '2026-03-08',
    '2026-03-09',
  ]);
});
