import { useState } from 'react';
import { usePreferences } from '../../preferences';
import type { DashboardFacets } from '../summaryTypes';
import type { DashboardViewProps } from '../viewTypes';
import { DashboardWidgetEditor } from './DashboardWidgetEditor';
import { DashboardWidgetPicker } from './DashboardWidgetPicker';
import { titleKeys } from './dashboardLabels';

export function DashboardWidgetSettings({
  preferences,
  onPreferences,
  facets,
  lessons,
}: Pick<DashboardViewProps, 'preferences' | 'onPreferences' | 'lessons'> & {
  facets?: DashboardFacets;
}) {
  const { t } = usePreferences();
  const [selected, setSelected] = useState('');
  const visible = preferences.widgets.filter((widget) => widget.visible);
  const widget = visible.find((widget) => widget.id === selected) ?? visible[0];

  return (
    <div className="dashboard-settings-body">
      {widget && (
        <>
          <label className="dashboard-chart-picker">
            {t('dashboardSectionWidget')}
            <select value={widget.id} onChange={(event) => setSelected(event.target.value)}>
              {visible.map((item, index) => (
                <option key={item.id} value={item.id}>
                  {t(titleKeys[item.kind])}
                  {visible.some((other) => other.id !== item.id && other.kind === item.kind) &&
                    ` (${index + 1})`}
                </option>
              ))}
            </select>
          </label>
          <DashboardWidgetEditor
            key={widget.id}
            widget={widget}
            facets={facets}
            lessons={lessons}
            preferences={preferences}
            onPreferences={onPreferences}
          />
        </>
      )}
      <details>
        <summary>{t('dashboardAddWidget')}</summary>
        <DashboardWidgetPicker preferences={preferences} onPreferences={onPreferences} />
      </details>
    </div>
  );
}
