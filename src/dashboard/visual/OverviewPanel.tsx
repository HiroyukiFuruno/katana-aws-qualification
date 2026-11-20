import { usePreferences } from '../../preferences';
import type { DashboardMetric } from '../preferenceTypes';
import type { DashboardStats } from '../statTypes';
import { metricKeys } from '../ui/dashboardLabels';
import { useDashboardDensity } from './DashboardDensity';
import { dashboardMetricValue, formatDashboardValue } from './format';

export function OverviewPanel({ total }: { total: DashboardStats }) {
  const { locale, t } = usePreferences();
  const density = useDashboardDensity();
  const metrics: DashboardMetric[] =
    density === 'compact'
      ? ['answered', 'accuracy']
      : ['answered', 'accuracy', 'durationMs', 'meanDurationMs'];
  return (
    <div className="dashboard-viz-metrics">
      {metrics.map((metric) => (
        <div className="dashboard-viz-metric" key={metric}>
          <span>{t(metricKeys[metric])}</span>
          <strong>
            {formatDashboardValue(
              dashboardMetricValue(total, metric),
              metric,
              locale,
              t('dashboardNotMeasured'),
            )}
          </strong>
          {metric === 'accuracy' && (
            <small>
              {total.correct} / {total.answered}
            </small>
          )}
        </div>
      ))}
    </div>
  );
}
