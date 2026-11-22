import { expect, test } from 'bun:test';
import { readDashboardPreferences } from '../src/dashboard/preferenceCodec';
import { dashboardDefaults } from '../src/dashboard/preferences';
import { dashboardOverrideKeys } from '../src/dashboard/ui/dashboardWidgetOverrides';
import { agendaDate, agendaRows } from '../src/milestones/presentationTypes';
import type { Milestone } from '../src/milestones/types';

test('new defaults expose planning without rewriting an existing layout', () => {
  const defaults = dashboardDefaults('UTC');
  const planning = defaults.widgets.find(({ kind }) => kind === 'milestones');
  expect(planning).toMatchObject({ visible: true, chart: 'calendar', width: 'wide' });
  const old = { ...defaults, widgets: defaults.widgets.filter(({ kind }) => kind !== 'milestones') };
  expect(readDashboardPreferences(old)).toEqual(old);
  expect(old.widgets).toHaveLength(14);
  expect(readDashboardPreferences(defaults)).toEqual(defaults);
});

test('planning settings allow calendar or list with only qualification and timezone overrides', () => {
  const settings = dashboardDefaults('UTC');
  const widget = settings.widgets.find(({ kind }) => kind === 'milestones');
  if (!widget) throw new Error('Planning widget missing');
  widget.chart = 'table';
  widget.overrides = { certificationIds: ['saa-c03'], timezone: 'America/New_York' };
  expect(readDashboardPreferences(settings)).toEqual(settings);
  expect(dashboardOverrideKeys('milestones')).toEqual(['certificationIds', 'timezone']);
  widget.overrides.period = 'all';
  expect(() => readDashboardPreferences(settings)).toThrow();
  delete widget.overrides.period;
  widget.metric = 'accuracy';
  expect(() => readDashboardPreferences(settings)).toThrow();
});

test('agenda preserves date-only plans and converts timed plans before ordering days', () => {
  const plain: Milestone = {
    id: crypto.randomUUID(),
    certificationId: 'saa-c03',
    kind: 'target',
    title: 'Target',
    plannedOn: '2026-03-01',
    plannedAt: null,
    completed: false,
    revision: 0,
  };
  const timed: Milestone = {
    ...plain,
    id: crypto.randomUUID(),
    kind: 'study',
    plannedOn: null,
    plannedAt: '2026-03-01T00:30:00.000Z',
  };
  expect(agendaDate(plain, 'America/Los_Angeles')).toBe('2026-03-01');
  expect(agendaDate(timed, 'America/Los_Angeles')).toBe('2026-02-28');
  expect(agendaRows([plain, timed], 'America/Los_Angeles').map(({ id }) => id)).toEqual([
    timed.id,
    plain.id,
  ]);
  expect(agendaDate(timed, 'Asia/Tokyo')).toBe('2026-03-01');
});
