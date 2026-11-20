import { usePreferences } from '../../preferences';
import type { DashboardWidget } from '../preferenceTypes';
import type { DashboardSummary } from '../summaryTypes';
import { metricKeys, titleKeys } from '../ui/dashboardLabels';
import { CalendarChart } from './CalendarChart';
import { DurationPanel } from './DurationPanel';
import { dashboardCalendarDays } from './daily';
import { dashboardMetricValue, formatDashboardValue } from './format';
import { dashboardGroupRows } from './groupRows';
import { dashboardDimensionLabel } from './labels';
import { SeriesChart } from './SeriesChart';
import { StatsTable } from './StatsTable';
import { TimeChart } from './TimeChart';
import './visual.css';

export function DashboardVisual({
  widget,
  summary,
}: {
  widget: DashboardWidget;
  summary: DashboardSummary;
}) {
  const { locale, t } = usePreferences();
  if (widget.kind === 'durations') return <DurationPanel widget={widget} duration={summary.duration} />;
  if (widget.kind === 'trend' || widget.kind === 'calendar') {
    const daily = dashboardCalendarDays(summary.daily, summary.query);
    const rows = daily.map((day) => ({
      id: day.date,
      label: new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(
        new Date(`${day.date}T00:00:00Z`),
      ),
      stats: day,
    }));
    const metric = t(metricKeys[widget.metric]);
    return (
      <div className="dashboard-viz">
        {widget.kind === 'calendar' ? (
          <CalendarChart daily={daily} query={summary.query} metric={widget.metric} label={metric} />
        ) : (
          <TimeChart
            points={rows.map((row) => ({
              ...row,
              value: dashboardMetricValue(row.stats, widget.metric),
              time: Date.parse(`${row.id}T00:00:00Z`),
            }))}
            label={metric}
            percentage={widget.metric === 'accuracy'}
            area={widget.chart === 'area'}
            bar={widget.chart === 'bar'}
            format={(value) =>
              formatDashboardValue(value, widget.metric, locale, t('dashboardNotMeasured'))
            }
          />
        )}
        <StatsTable rows={rows} caption={t(titleKeys[widget.kind])} />
      </div>
    );
  }
  return (
    <SeriesChart
      widget={widget}
      rows={dashboardGroupRows(widget, summary, (value) => dashboardDimensionLabel(value, t))}
      categories={summary.groups.categories}
    />
  );
}
