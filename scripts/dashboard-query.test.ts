import { describe, expect, test } from 'bun:test';
import { readDashboardPreferences } from '../src/dashboard/preferenceCodec';
import { dashboardDefaults } from '../src/dashboard/preferences';
import { buildDashboardQuery, readDashboardQuery } from '../src/dashboard/query';

describe('dashboard query and preferences contracts', () => {
  test('counts local calendar days across both DST boundaries', () => {
    const filters = { ...dashboardDefaults('America/New_York').filters, period: '7d' as const };
    const spring = buildDashboardQuery(filters, Date.parse('2026-03-09T12:00:00Z'));
    expect(spring.range).toEqual({
      from: '2026-03-03T05:00:00.000Z',
      to: '2026-03-09T12:00:00.001Z',
      timezone: 'America/New_York',
    });
    const autumn = buildDashboardQuery(filters, Date.parse('2026-11-02T12:00:00Z'));
    expect(autumn.range.from).toBe('2026-10-27T04:00:00.000Z');
    expect(readDashboardQuery(spring)).toEqual(spring);
  });

  test('all time has no invented epoch and arrays are canonical', () => {
    const filters = { ...dashboardDefaults('Asia/Tokyo').filters, period: 'all' as const };
    filters.certificationIds = ['saa-c03', 'aif-c01'];
    const query = buildDashboardQuery(filters, 1000);
    expect(query.range.from).toBeNull();
    expect(query.certificationIds).toEqual(['aif-c01', 'saa-c03']);
    expect(() => readDashboardQuery({ ...query, modes: [] })).toThrow();
    expect(() => readDashboardQuery({ ...query, surprise: true })).toThrow();
    expect(() => readDashboardQuery({ ...query, modes: ['study', 'study'] })).toThrow();
    expect(() =>
      readDashboardQuery({ ...query, range: { ...query.range, timezone: 'Mars' } }),
    ).toThrow();
  });

  test('explicit all overrides a global qualification but omitted values inherit', () => {
    const prefs = dashboardDefaults('UTC');
    prefs.filters.certificationIds = ['saa-c03'];
    const overridden = { ...prefs.filters, ...{ certificationIds: null } };
    expect(buildDashboardQuery(overridden, 1000).certificationIds).toBeNull();
    expect(buildDashboardQuery(prefs.filters, 1000).certificationIds).toEqual(['saa-c03']);
    expect(readDashboardPreferences(prefs)).toEqual(prefs);
    expect(prefs.widgets.filter((widget) => widget.visible)).toHaveLength(10);
    expect(prefs.widgets).toHaveLength(15);
  });

  test('rejects incompatible charts, duplicate instances and unknown settings', () => {
    const prefs = dashboardDefaults('UTC');
    const categories = prefs.widgets.find((widget) => widget.kind === 'categories');
    if (!categories) throw new Error('Missing category widget');
    categories.chart = 'radar';
    categories.metric = 'durationMs';
    expect(() => readDashboardPreferences(prefs)).toThrow();
    categories.metric = 'accuracy';
    expect(readDashboardPreferences(prefs)).toEqual(prefs);
    prefs.widgets.push({ ...categories });
    expect(() => readDashboardPreferences(prefs)).toThrow();
    expect(() => readDashboardPreferences({ ...dashboardDefaults('UTC'), history: [] })).toThrow();
  });
});
