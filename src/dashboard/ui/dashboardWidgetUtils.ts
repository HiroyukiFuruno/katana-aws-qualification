import type { DashboardWidget } from '../preferenceTypes';
import type { DashboardViewProps } from '../viewTypes';
import { dashboardChartMetrics, dashboardWidgetDefinition } from '../widgetRegistry';

export function updateWidget(
  preferences: DashboardViewProps['preferences'],
  id: string,
  patch: Partial<DashboardWidget>,
) {
  return {
    ...preferences,
    widgets: preferences.widgets.map((widget) => {
      if (widget.id !== id) return widget;
      const next = { ...widget, ...patch };
      if (patch.chart) {
        const compatible = dashboardChartMetrics(dashboardWidgetDefinition(next.kind), patch.chart);
        if (!compatible.includes(next.metric)) next.metric = compatible[0];
      }
      return next;
    }),
  };
}
