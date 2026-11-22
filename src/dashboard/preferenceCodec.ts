import { dashboardArray, dashboardEnum, dashboardRecord, dashboardText } from './codec';
import { readDashboardFilters, readDashboardOverrides } from './filterCodec';
import type { DashboardPreferences, DashboardWidget } from './preferenceTypes';
import { dashboardChartMetrics, dashboardWidgetDefinition, dashboardWidgets } from './widgetRegistry';

function readWidget(value: unknown): DashboardWidget {
  const row = dashboardRecord(value, [
    'id',
    'kind',
    'visible',
    'width',
    'chart',
    'metric',
    'dimension',
    'overrides',
  ]);
  const id = dashboardText(row.id, 80);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id) || typeof row.visible !== 'boolean')
    throw new Error('Invalid dashboard widget.');
  const kind = dashboardEnum(
    row.kind,
    dashboardWidgets.map((definition) => definition.kind),
  );
  const definition = dashboardWidgetDefinition(kind);
  const chart = dashboardEnum(row.chart, definition.charts);
  const metric = dashboardEnum(row.metric, dashboardChartMetrics(definition, chart));
  const dimension = dashboardEnum(row.dimension, ['default', 'polarity']);
  if (dimension === 'polarity' && kind !== 'formats') throw new Error('Invalid widget dimension.');
  const overrides = readDashboardOverrides(row.overrides);
  if (
    kind === 'milestones' &&
    Object.keys(overrides).some((key) => key !== 'certificationIds' && key !== 'timezone')
  )
    throw new Error('Invalid schedule display filters.');
  return {
    id,
    kind,
    visible: row.visible,
    width: dashboardEnum(row.width, ['normal', 'wide']),
    chart,
    metric,
    dimension,
    overrides,
  };
}

export function readDashboardPreferences(value: unknown): DashboardPreferences {
  const row = dashboardRecord(value, ['schemaVersion', 'filters', 'widgets']);
  if (row.schemaVersion !== 1) throw new Error('Unsupported dashboard settings version.');
  const widgets = dashboardArray(row.widgets, readWidget, 20);
  if (!widgets.length || new Set(widgets.map((widget) => widget.id)).size !== widgets.length)
    throw new Error('Invalid dashboard widget instances.');
  return { schemaVersion: 1, filters: readDashboardFilters(row.filters), widgets };
}
