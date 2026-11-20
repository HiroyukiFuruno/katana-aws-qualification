import { describe, expect, test } from 'bun:test';
import { readDashboardPreferences } from '../src/dashboard/preferenceCodec';
import { dashboardDefaults } from '../src/dashboard/preferences';
import { dashboardFilterOptions } from '../src/dashboard/ui/dashboardFilterOptions';
import { updateWidgetOverride } from '../src/dashboard/ui/dashboardWidgetOverrides';
import { updateWidget } from '../src/dashboard/ui/dashboardWidgetUtils';

describe('dashboard widget override persistence', () => {
  test('changing to radar also selects a compatible metric before applying or saving', () => {
    const prefs = dashboardDefaults('UTC');
    const category = prefs.widgets.find((widget) => widget.kind === 'categories');
    if (!category) throw new Error('Missing category widget');
    category.metric = 'meanDurationMs';
    const changed = updateWidget(prefs, category.id, { chart: 'radar' });
    expect(changed.widgets.find((widget) => widget.id === category.id)?.metric).toBe('accuracy');
    expect(readDashboardPreferences(changed)).toEqual(changed);
  });
  test('inherit removes the property, custom stores values, all stores null', () => {
    const prefs = dashboardDefaults('UTC');
    const source = prefs.widgets.find((widget) => widget.kind === 'trend');
    if (!source) throw new Error('trend widget missing');
    let widget = updateWidgetOverride(source, 'period', '7d');
    widget = updateWidgetOverride(widget, 'certificationIds', ['saa-c03']);
    widget = updateWidgetOverride(widget, 'revisions', [{ sourceVersion: 'v/1', questionRevision: 2 }]);
    expect(widget.overrides.period).toBe('7d');
    expect(widget.overrides.certificationIds).toEqual(['saa-c03']);
    expect(widget.overrides.revisions).toEqual([{ sourceVersion: 'v/1', questionRevision: 2 }]);
    widget = updateWidgetOverride(widget, 'categories', null);
    expect(widget.overrides.categories).toBeNull();
    widget = updateWidgetOverride(widget, 'period', undefined);
    expect(Object.hasOwn(widget.overrides, 'period')).toBe(false);
    expect(
      readDashboardPreferences({
        ...prefs,
        widgets: [widget, ...prefs.widgets.filter((item) => item.id !== source.id)],
      }),
    ).toEqual({ ...prefs, widgets: [widget, ...prefs.widgets.filter((item) => item.id !== source.id)] });
  });
  test('empty facets still expose fixed and public choices and preserve current values', () => {
    const filters = dashboardDefaults('UTC').filters;
    filters.certificationIds = ['legacy-cert'];
    filters.modes = ['exam'];
    filters.revisions = [{ sourceVersion: 'v/with/slash', questionRevision: 4 }];
    const options = dashboardFilterOptions(undefined, filters);
    expect(options.certificationIds).toContain('legacy-cert');
    expect(options.modes).toEqual(['study', 'review', 'exam']);
    expect(options.revisions).toContain(JSON.stringify(filters.revisions[0]));
    expect(new Set(options.categories).size).toBe(options.categories.length);
  });
});
