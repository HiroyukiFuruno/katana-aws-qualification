import { usePreferences } from '../../preferences';
import type { DashboardWidget } from '../preferenceTypes';
import type { DashboardCategoryStats } from '../statTypes';
import { chartKeys, metricKeys } from '../ui/dashboardLabels';
import { DonutChart } from './DonutChart';
import { dashboardCategoryLabel, dashboardMetricValue, formatDashboardValue } from './format';
import { canRenderRadar, RadarChart } from './RadarChart';
import { ScatterChart } from './ScatterChart';
import { type DashboardStatRow, StatsTable } from './StatsTable';
import { ValueBars } from './ValueBars';

export function SeriesChart({
  widget,
  rows,
  categories = [],
}: {
  widget: DashboardWidget;
  rows: readonly DashboardStatRow[];
  categories?: readonly DashboardCategoryStats[];
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
  if (widget.chart === 'donut')
    chart =
      points.filter((point) => (point.value ?? 0) > 0).length >= 2 ? (
        <DonutChart points={points} label={metric} format={format} />
      ) : (
        <p className="dashboard-viz-note">{t('dashboardDonutRequirement')}</p>
      );
  if (widget.chart === 'radar')
    chart = canRenderRadar(categories) ? (
      <RadarChart points={categories} label={metric} />
    ) : (
      <p className="dashboard-viz-note">{t('dashboardRadarRequirement')}</p>
    );
  if (widget.chart === 'scatter' || widget.chart === 'bubble')
    chart = (
      <>
        <p className="dashboard-viz-note">
          {t('dashboardAxisX', { metric: t('dashboardMetricAnswered') })} ·{' '}
          {t('dashboardAxisY', { metric: t('dashboardMetricAccuracy') })}
          {widget.chart === 'bubble' && <> · {t('dashboardMetricMeanDuration')}</>}
        </p>
        <ScatterChart
          points={categories}
          bubble={widget.chart === 'bubble'}
          label={metric}
          categoryLabel={(point) => dashboardCategoryLabel(point, t)}
        />
      </>
    );
  return (
    <div className="dashboard-viz">
      {chart}
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
        caption={`${t(chartKeys[widget.chart])} · ${metric}`}
      />
    </div>
  );
}
