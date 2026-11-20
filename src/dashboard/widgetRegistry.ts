import type { DashboardChart, DashboardWidgetKind } from './preferenceTypes';
import { dashboardWidgets } from './widgetDefinitions';
import type { DashboardWidgetDefinition } from './widgetDefinitionTypes';

export { dashboardWidgets } from './widgetDefinitions';
export type { DashboardWidgetDefinition } from './widgetDefinitionTypes';

export function dashboardWidgetDefinition(kind: DashboardWidgetKind) {
  const definition = dashboardWidgets.find((item) => item.kind === kind);
  if (!definition) throw new Error('Unknown dashboard widget.');
  return definition;
}

export function dashboardChartMetrics(definition: DashboardWidgetDefinition, chart: DashboardChart) {
  const compatible =
    chart === 'radar'
      ? ['accuracy']
      : chart === 'stacked'
        ? ['answered', 'accuracy']
        : chart === 'donut'
          ? ['answered', 'correct', 'incorrect', 'durationMs']
          : definition.metrics;
  return definition.metrics.filter((metric) => compatible.includes(metric));
}
