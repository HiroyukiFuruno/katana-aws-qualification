import { usePreferences } from '../../preferences';
import type { DashboardViewProps } from '../viewTypes';
import { dashboardWidgets } from '../widgetRegistry';
import { titleKeys } from './dashboardLabels';

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
          id: `${definition.kind}-${crypto.randomUUID()}`,
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
            {t('dashboardShowWidget')} {t(titleKeys[widget.kind])}
          </button>
        ))}
      {dashboardWidgets.map((definition) => (
        <button
          key={definition.kind}
          type="button"
          disabled={preferences.widgets.length >= 20}
          onClick={() => add(definition)}
        >
          {t('dashboardAddWidget')} {t(titleKeys[definition.kind])}
        </button>
      ))}
    </div>
  );
}
