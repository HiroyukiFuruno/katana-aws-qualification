import { usePreferences } from '../../preferences';
import type { DashboardChart, DashboardMetric } from '../preferenceTypes';
import { ChartSvg } from './ChartSvg';
import type { DashboardPoint } from './dashboardPoints';

function value(point: DashboardPoint, metric: DashboardMetric) {
  if (metric === 'incorrect') return point.stats.answered - point.stats.correct;
  if (metric === 'accuracy') return point.stats.accuracy === null ? null : point.stats.accuracy * 100;
  return point.stats[metric];
}
export function DashboardChartView({
  chart,
  metric,
  points,
  label,
}: {
  chart: DashboardChart;
  metric: DashboardMetric;
  points: readonly DashboardPoint[];
  label: string;
}) {
  if (!points.length) return null;
  return (
    <div className="dashboard-chart-with-table">
      <ChartSvg chart={chart} metric={metric} points={points} label={label} />
      <DashboardTable points={points} metric={metric} />
    </div>
  );
}
function DashboardTable({
  points,
  metric,
}: {
  points: readonly DashboardPoint[];
  metric: DashboardMetric;
}) {
  const { t } = usePreferences();
  const metricKeys: Record<DashboardMetric, Parameters<typeof t>[0]> = {
    answered: 'dashboardMetricAnswered',
    correct: 'dashboardMetricCorrect',
    incorrect: 'dashboardMetricIncorrect',
    accuracy: 'dashboardMetricAccuracy',
    durationMs: 'dashboardMetricDuration',
    meanDurationMs: 'dashboardMetricMeanDuration',
  };
  return (
    <div className="dashboard-table-wrap">
      <table className="dashboard-table">
        <thead>
          <tr>
            <th scope="col">{t('dashboardGroup')}</th>
            <th scope="col">{t(metricKeys[metric])}</th>
            <th scope="col">{t('dashboardAnswers')}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.key}>
              <th scope="row">{point.key}</th>
              <td>{value(point, metric) ?? '—'}</td>
              <td>{point.stats.answered}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
