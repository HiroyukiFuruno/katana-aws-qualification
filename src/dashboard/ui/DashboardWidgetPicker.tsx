import { usePreferences } from '../../preferences';
import type { DashboardViewProps } from '../viewTypes';
import { dashboardWidgets } from '../widgetRegistry';

export function DashboardWidgetPicker({
  preferences,
  onPreferences,
}: {
  preferences: DashboardViewProps['preferences'];
  onPreferences: DashboardViewProps['onPreferences'];
}) {
  const { t } = usePreferences();
  const reveal = (id: string) =>
    onPreferences({
      ...preferences,
      widgets: preferences.widgets.map((item) => (item.id === id ? { ...item, visible: true } : item)),
    });
  const add = (definition: (typeof dashboardWidgets)[number]) =>
    onPreferences({
      ...preferences,
      widgets: [
        ...preferences.widgets,
        {
          id: `${definition.kind}-${Date.now()}`,
          kind: definition.kind,
          visible: true,
          width: definition.defaultWidth,
          chart: definition.defaultChart,
          metric: definition.defaultMetric,
          dimension: 'default',
          overrides: {},
        },
      ],
    });
  return (
    <div className="dashboard-widget-picker">
      {preferences.widgets
        .filter((widget) => !widget.visible)
        .map((widget) => (
          <button key={widget.id} type="button" onClick={() => reveal(widget.id)}>
            {t('dashboardShowWidget')} {widget.kind}
          </button>
        ))}
      {dashboardWidgets
        .filter((definition) => !preferences.widgets.some((widget) => widget.kind === definition.kind))
        .map((definition) => (
          <button
            key={definition.kind}
            type="button"
            disabled={preferences.widgets.length >= 20}
            onClick={() => add(definition)}
          >
            {t('dashboardShowWidget')} {definition.kind}
          </button>
        ))}
    </div>
  );
}
