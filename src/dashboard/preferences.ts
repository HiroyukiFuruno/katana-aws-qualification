import { dashboardTimezone } from './codec';
import { dashboardDimensionKeys } from './filterCodec';
import type { DashboardPreferences } from './preferenceTypes';
import type { DashboardDimensions } from './queryTypes';
import { dashboardWidgets } from './widgetRegistry';

export function dashboardDefaults(timezone: string): DashboardPreferences {
  return {
    schemaVersion: 1,
    filters: {
      ...(Object.fromEntries(dashboardDimensionKeys.map((key) => [key, null])) as DashboardDimensions),
      period: '30d',
      timezone: dashboardTimezone(timezone),
    },
    widgets: dashboardWidgets.map((definition) => ({
      id: definition.kind,
      kind: definition.kind,
      visible: definition.defaultVisible,
      width: definition.defaultWidth,
      chart: definition.defaultChart,
      metric: definition.defaultMetric,
      dimension: 'default',
      overrides: {},
    })),
  };
}
