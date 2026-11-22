import type { DashboardFilters } from './queryTypes';

export type DashboardMetric =
  | 'answered'
  | 'correct'
  | 'incorrect'
  | 'accuracy'
  | 'durationMs'
  | 'meanDurationMs';
export type DashboardChart =
  | 'metrics'
  | 'line'
  | 'bar'
  | 'area'
  | 'stacked'
  | 'donut'
  | 'radar'
  | 'heatmap'
  | 'scatter'
  | 'bubble'
  | 'histogram'
  | 'box'
  | 'table'
  | 'ring'
  | 'calendar';
export type DashboardWidgetKind =
  | 'overview'
  | 'trend'
  | 'calendar'
  | 'certifications'
  | 'categories'
  | 'modes'
  | 'contexts'
  | 'formats'
  | 'revisions'
  | 'durations'
  | 'relationship'
  | 'reviews'
  | 'exams'
  | 'lessons'
  | 'milestones';

export type DashboardWidget = {
  id: string;
  kind: DashboardWidgetKind;
  visible: boolean;
  width: 'normal' | 'wide';
  chart: DashboardChart;
  metric: DashboardMetric;
  dimension: 'default' | 'polarity';
  overrides: Partial<DashboardFilters>;
};

export type DashboardPreferences = {
  schemaVersion: 1;
  filters: DashboardFilters;
  widgets: DashboardWidget[];
};

export type DashboardSettingsSnapshot = {
  revision: number;
  settings: DashboardPreferences | null;
};
