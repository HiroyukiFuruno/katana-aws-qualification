import type { usePreferences } from '../../preferences';
import type { DashboardChart, DashboardMetric, DashboardWidget } from '../preferenceTypes';

type LocaleKey = Parameters<ReturnType<typeof usePreferences>['t']>[0];
export const titleKeys: Record<DashboardWidget['kind'], LocaleKey> = {
  overview: 'dashboardWidgetOverview',
  trend: 'dashboardWidgetTrend',
  calendar: 'dashboardWidgetCalendar',
  certifications: 'dashboardWidgetCertifications',
  categories: 'dashboardWidgetCategories',
  modes: 'dashboardWidgetModes',
  contexts: 'dashboardWidgetContexts',
  formats: 'dashboardWidgetFormats',
  revisions: 'dashboardWidgetRevisions',
  durations: 'dashboardWidgetDurations',
  relationship: 'dashboardWidgetRelationship',
  reviews: 'dashboardWidgetReviews',
  exams: 'dashboardWidgetExams',
  lessons: 'dashboardWidgetLessons',
  milestones: 'dashboardMilestones',
};
export const chartKeys: Record<DashboardChart, LocaleKey> = {
  metrics: 'dashboardChartMetrics',
  line: 'dashboardChartLine',
  bar: 'dashboardChartBar',
  area: 'dashboardChartArea',
  stacked: 'dashboardChartStacked',
  donut: 'dashboardChartDonut',
  radar: 'dashboardChartRadar',
  heatmap: 'dashboardChartHeatmap',
  scatter: 'dashboardChartScatter',
  bubble: 'dashboardChartBubble',
  histogram: 'dashboardChartHistogram',
  box: 'dashboardChartBox',
  table: 'dashboardChartTable',
  ring: 'dashboardChartRing',
  calendar: 'dashboardChartCalendar',
};
export const metricKeys: Record<DashboardMetric, LocaleKey> = {
  answered: 'dashboardMetricAnswered',
  correct: 'dashboardMetricCorrect',
  incorrect: 'dashboardMetricIncorrect',
  accuracy: 'dashboardMetricAccuracy',
  durationMs: 'dashboardMetricDuration',
  meanDurationMs: 'dashboardMetricMeanDuration',
};
