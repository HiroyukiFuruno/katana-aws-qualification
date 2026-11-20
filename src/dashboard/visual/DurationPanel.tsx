import { usePreferences } from '../../preferences';
import type { DashboardWidget } from '../preferenceTypes';
import type { DashboardDuration } from '../statTypes';
import { BoxChart } from './BoxChart';
import { DashboardDataTable } from './DataTable';
import { formatDashboardValue } from './format';
import { ValueBars } from './ValueBars';

export function DurationPanel({
  widget,
  duration,
}: {
  widget: DashboardWidget;
  duration: DashboardDuration;
}) {
  const { locale, t } = usePreferences();
  const seconds = (value: number | null) =>
    formatDashboardValue(value, 'durationMs', locale, t('dashboardNotMeasured'));
  const bins = duration.bins.map((bin) => ({
    id: String(bin.lowerMs),
    label:
      bin.upperMs === null
        ? `≥ ${seconds(bin.lowerMs)}`
        : `${seconds(bin.lowerMs)} – < ${seconds(bin.upperMs)}`,
    value: bin.count,
    correct: 0,
    incorrect: 0,
  }));
  const keys = ['min', 'p05', 'p25', 'p50', 'p75', 'p95', 'max'] as const;
  const labels = [
    t('dashboardMinimum'),
    '5%',
    t('dashboardQ1'),
    t('dashboardMedian'),
    t('dashboardQ3'),
    '95%',
    t('dashboardMaximum'),
  ];
  return (
    <div className="dashboard-viz">
      {widget.chart === 'histogram' ? (
        <>
          <p className="dashboard-viz-note">{t('dashboardTimeBins')}</p>
          <ValueBars
            points={bins}
            label={t('dashboardTimeBins')}
            format={(value) => new Intl.NumberFormat(locale).format(value ?? 0)}
          />
        </>
      ) : (
        <>
          <BoxChart duration={duration} label={t('dashboardWidgetDurations')} />
          <p className="dashboard-viz-note">{t('dashboardWhiskerRange')}</p>
        </>
      )}
      <DashboardDataTable
        caption={t('dashboardWidgetDurations')}
        columns={[
          { id: 'label', label: t('dashboardGroup') },
          { id: 'value', label: t('dashboardMetricDuration'), numeric: true },
        ]}
        rows={keys.map((key, index) => ({
          id: key,
          cells: { label: labels[index], value: seconds(duration[key]) },
        }))}
      />
      <DashboardDataTable
        caption={t('dashboardTimeBins')}
        columns={[
          { id: 'label', label: t('dashboardMetricDuration') },
          { id: 'count', label: t('dashboardAnswers'), numeric: true },
        ]}
        rows={bins.map((bin) => ({
          id: bin.id,
          cells: { label: bin.label, count: new Intl.NumberFormat(locale).format(bin.value) },
        }))}
      />
    </div>
  );
}
