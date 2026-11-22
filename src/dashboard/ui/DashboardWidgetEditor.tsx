import { usePreferences } from '../../preferences';
import type { DashboardChart, DashboardMetric, DashboardWidget } from '../preferenceTypes';
import type { DashboardFacets } from '../summaryTypes';
import type { DashboardViewProps } from '../viewTypes';
import { dashboardChartMetrics, dashboardWidgetDefinition } from '../widgetRegistry';
import { DashboardWidgetOptions } from './DashboardWidgetOptions';
import { chartKeys, metricKeys } from './dashboardLabels';
import { dashboardSections } from './dashboardPresentation';
import { updateWidget } from './dashboardWidgetUtils';

export function DashboardWidgetEditor({
  widget,
  preferences,
  onPreferences,
  facets,
  lessons,
}: {
  widget: DashboardWidget;
  preferences: DashboardViewProps['preferences'];
  onPreferences: DashboardViewProps['onPreferences'];
  facets?: DashboardFacets;
  lessons: DashboardViewProps['lessons'];
}) {
  const { t } = usePreferences();
  const definition = dashboardWidgetDefinition(widget.kind);
  const section = dashboardSections.find(({ kinds }) => kinds.includes(widget.kind));
  const visible = preferences.widgets.filter(
    (item) => item.visible && section?.kinds.includes(item.kind),
  );
  const current = visible.findIndex((item) => item.id === widget.id);
  const move = (direction: -1 | 1) => {
    const neighbor = visible[current + direction];
    if (!neighbor) return;
    const index = preferences.widgets.findIndex((item) => item.id === widget.id);
    const target = preferences.widgets.findIndex((item) => item.id === neighbor.id);
    const next = [...preferences.widgets];
    [next[index], next[target]] = [next[target], next[index]];
    onPreferences({ ...preferences, widgets: next });
  };
  return (
    <div className="dashboard-widget-editor">
      <div className="dashboard-widget-actions">
        <button
          type="button"
          aria-disabled={current <= 0}
          onClick={() => move(-1)}
          aria-label={t('dashboardMoveUp')}
        >
          ↑
        </button>
        <button
          type="button"
          aria-disabled={current >= visible.length - 1}
          onClick={() => move(1)}
          aria-label={t('dashboardMoveDown')}
        >
          ↓
        </button>
        <button
          type="button"
          onClick={() => onPreferences(updateWidget(preferences, widget.id, { visible: false }))}
        >
          {t('dashboardHideWidget')}
        </button>
      </div>
      <div className="dashboard-widget-options">
        <label>
          {t('dashboardChart')}
          <select
            value={widget.chart}
            onChange={(e) =>
              onPreferences(
                updateWidget(preferences, widget.id, { chart: e.target.value as DashboardChart }),
              )
            }
          >
            {definition.charts.map((chart) => (
              <option key={chart} value={chart}>
                {t(chartKeys[chart])}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('dashboardMetric')}
          <select
            value={widget.metric}
            onChange={(e) =>
              onPreferences(
                updateWidget(preferences, widget.id, { metric: e.target.value as DashboardMetric }),
              )
            }
          >
            {dashboardChartMetrics(definition, widget.chart).map((metric) => (
              <option key={metric} value={metric}>
                {t(metricKeys[metric])}
              </option>
            ))}
          </select>
        </label>
        <DashboardWidgetOptions
          widget={widget}
          facets={facets}
          lessons={lessons.status === 'ready' ? lessons.items : []}
          onChange={(next) => onPreferences(updateWidget(preferences, widget.id, next))}
        />
      </div>
    </div>
  );
}
