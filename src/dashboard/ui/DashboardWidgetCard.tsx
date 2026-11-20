import { usePreferences } from '../../preferences';
import type { DashboardChart, DashboardMetric, DashboardWidget } from '../preferenceTypes';
import type { DashboardFacets } from '../summaryTypes';
import type { DashboardDataState, DashboardViewProps } from '../viewTypes';
import { dashboardChartMetrics, dashboardWidgetDefinition } from '../widgetRegistry';
import { DashboardWidgetOptions } from './DashboardWidgetOptions';
import { DashboardWidgetState } from './DashboardWidgetState';
import { chartKeys, metricKeys, titleKeys } from './dashboardLabels';
import { updateWidget } from './dashboardWidgetUtils';

export function DashboardWidgetCard({
  widget,
  state,
  lessons,
  preferences,
  onPreferences,
  facets,
}: {
  widget: DashboardWidget;
  state: DashboardDataState;
  lessons: DashboardViewProps['lessons'];
  preferences: DashboardViewProps['preferences'];
  onPreferences: DashboardViewProps['onPreferences'];
  facets?: DashboardFacets;
}) {
  const { t } = usePreferences();
  const definition = dashboardWidgetDefinition(widget.kind);
  const move = (direction: -1 | 1) => {
    const visible = preferences.widgets.filter((item) => item.visible);
    const current = visible.findIndex((item) => item.id === widget.id);
    const neighbor = visible[current + direction];
    if (!neighbor) return;
    const index = preferences.widgets.findIndex((item) => item.id === widget.id);
    const target = preferences.widgets.findIndex((item) => item.id === neighbor.id);
    const next = [...preferences.widgets];
    [next[index], next[target]] = [next[target], next[index]];
    onPreferences({ ...preferences, widgets: next });
  };
  return (
    <section
      className={`card dashboard-widget dashboard-widget-${widget.width}`}
      aria-labelledby={`dashboard-widget-${widget.id}`}
    >
      <div className="dashboard-widget-heading">
        <h2 id={`dashboard-widget-${widget.id}`}>{t(titleKeys[widget.kind])}</h2>
        {Object.keys(widget.overrides).length > 0 && (
          <span className="eyebrow">{t('dashboardOverrideCustom')}</span>
        )}
      </div>
      <details className="dashboard-widget-customize">
        <summary>{t('dashboardCustomize')}</summary>
        <div className="dashboard-widget-actions">
          <button type="button" onClick={() => move(-1)} aria-label={t('dashboardMoveUp')}>
            ↑
          </button>
          <button type="button" onClick={() => move(1)} aria-label={t('dashboardMoveDown')}>
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
            onChange={(next) => onPreferences(updateWidget(preferences, widget.id, next))}
          />
        </div>
      </details>
      <DashboardWidgetState state={state} widget={widget} lessons={lessons} t={t} />
    </section>
  );
}
