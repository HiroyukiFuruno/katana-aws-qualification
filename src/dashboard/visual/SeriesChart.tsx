import type { Message } from '../../messages';
import { usePreferences } from '../../preferences';
import type { DashboardDisplayLabels } from '../displayLabels';
import type { DashboardWidget } from '../preferenceTypes';
import type { DashboardCategoryStats } from '../statTypes';
import { chartKeys, metricKeys } from '../ui/dashboardLabels';
import { DonutChart } from './DonutChart';
import { dashboardMetricValue, formatDashboardValue } from './format';
import { canRenderRadar, RadarChart } from './RadarChart';
import { ScatterChart } from './ScatterChart';
import { type DashboardStatRow, StatsTable } from './StatsTable';
import { ValueBars } from './ValueBars';

export function SeriesChart({
  widget,
  rows,
  categories = [],
  display,
}: {
  widget: DashboardWidget;
  rows: readonly DashboardStatRow[];
  categories?: readonly DashboardCategoryStats[];
  display: DashboardDisplayLabels;
}) {
  const { locale, t } = usePreferences();
  const metric = t(metricKeys[widget.metric]);
  const format = (value: number | null) =>
    formatDashboardValue(value, widget.metric, locale, t('dashboardNotMeasured'));
  const points = rows.map((row) => ({
    ...row,
    value: dashboardMetricValue(row.stats, widget.metric),
    correct: row.stats.correct,
    incorrect: row.stats.answered - row.stats.correct,
  }));
  let chart = null;
  let notice: Message | undefined;
  if (widget.chart === 'bar' || widget.chart === 'stacked')
    chart = (
      <ValueBars
        points={points}
        label={metric}
        format={format}
        percent={widget.metric === 'accuracy'}
        stacked={widget.chart === 'stacked'}
      />
    );
  if (widget.chart === 'donut') {
    if (points.filter((point) => (point.value ?? 0) > 0).length >= 2)
      chart = <DonutChart points={points} label={metric} format={format} />;
    else notice = 'dashboardDonutRequirement';
  }
  if (widget.chart === 'radar') {
    if (canRenderRadar(categories)) chart = <RadarChart points={categories} label={metric} />;
    else notice = 'dashboardRadarRequirement';
  }
  if (widget.chart === 'scatter' || widget.chart === 'bubble')
    chart = (
      <>
        <p className="dashboard-viz-note">
          {t('dashboardChartAxes', { x: t('dashboardMetricAnswered'), y: t('dashboardMetricAccuracy') })}
          {widget.chart === 'bubble' && <> · {t('dashboardMetricMeanDuration')}</>}
        </p>
        <ScatterChart
          points={categories}
          bubble={widget.chart === 'bubble'}
          label={metric}
          categoryLabel={(point) =>
            `${display.certification(point.certificationId)} · ${display.category(point.category)} · ${display.revision(point.sourceVersion, point.questionRevision)}`
          }
        />
      </>
    );
  return (
    <div className="dashboard-viz">
      {chart}
      {notice && <p className="dashboard-viz-note">{t(notice)}</p>}
      {widget.chart === 'stacked' && (
        <p className="dashboard-viz-legend-text">
          ● {t('dashboardMetricCorrect')} / ○ {t('dashboardMetricIncorrect')}
        </p>
      )}
      <StatsTable
        rows={
          widget.chart === 'radar'
            ? rows.map((row, index) => ({ ...row, label: `${index + 1}. ${row.label}` }))
            : rows
        }
        primary={chart === null}
        caption={`${t(chartKeys[widget.chart])} · ${metric}`}
      />
    </div>
  );
}
