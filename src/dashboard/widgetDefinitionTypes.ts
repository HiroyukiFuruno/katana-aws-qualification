import type { DashboardChart, DashboardMetric, DashboardWidgetKind } from './preferenceTypes';

export type DashboardWidgetDefinition = {
  kind: DashboardWidgetKind;
  charts: readonly DashboardChart[];
  metrics: readonly DashboardMetric[];
  defaultChart: DashboardChart;
  defaultMetric: DashboardMetric;
  defaultVisible: boolean;
  defaultWidth: 'normal' | 'wide';
};
