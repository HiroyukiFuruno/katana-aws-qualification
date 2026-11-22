import { useState } from 'react';
import { useMilestones } from '../../milestones/useMilestones';
import { usePreferences } from '../../preferences';
import type { DashboardViewProps } from '../viewTypes';
import { DashboardTabs } from './DashboardTabs';
import { DashboardWidgetCard } from './DashboardWidgetCard';
import { titleKeys } from './dashboardLabels';
import { type DashboardDensity, dashboardSections } from './dashboardPresentation';

export function DashboardSections({
  preferences,
  data,
  lessons,
  density,
  milestoneApi = null,
}: Pick<DashboardViewProps, 'preferences' | 'data' | 'lessons' | 'milestoneApi'> & {
  density: DashboardDensity;
}) {
  const { t } = usePreferences();
  const [requestedSection, setSection] = useState('activity');
  const [selectedWidgets, setSelectedWidgets] = useState<Record<string, string>>({});
  const visible = preferences.widgets.filter((widget) => widget.visible);
  const milestones = useMilestones(
    visible.some((widget) => widget.kind === 'milestones') ? milestoneApi : null,
  );
  const sections = dashboardSections
    .map((section) => ({
      ...section,
      widgets: visible.filter((widget) => section.kinds.includes(widget.kind)),
    }))
    .filter((section) => section.widgets.length > 0);
  const section = sections.find(({ id }) => id === requestedSection) ?? sections[0];
  if (!section) return <p className="dashboard-empty">{t('dashboardNoWidgets')}</p>;

  const selected =
    section.widgets.find(({ id }) => id === selectedWidgets[section.id]) ??
    section.widgets.find(({ kind }) => kind === 'trend') ??
    section.widgets[0];
  const widgets = density === 'full' ? section.widgets : [selected];
  const chartPicker = density !== 'full' && section.widgets.length > 1 && (
    <label className="dashboard-chart-picker">
      {t('dashboardSectionWidget')}
      <select
        value={selected.id}
        onChange={(event) =>
          setSelectedWidgets({ ...selectedWidgets, [section.id]: event.target.value })
        }
      >
        {section.widgets.map((widget, index) => (
          <option key={widget.id} value={widget.id}>
            {t(titleKeys[widget.kind])}
            {section.widgets.some((other) => other.id !== widget.id && other.kind === widget.kind) &&
              ` (${index + 1})`}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <DashboardTabs
      label={t('dashboardSectionTabs')}
      tabs={sections.map(({ id, label }) => ({ id, label: t(label) }))}
      selected={section.id}
      onSelect={setSection}
    >
      <div className={density === 'full' ? 'dashboard-grid' : 'dashboard-grid dashboard-grid-single'}>
        {widgets.map((widget) => (
          <DashboardWidgetCard
            key={density === 'full' ? widget.id : section.id}
            widget={widget}
            state={data.get(widget.id) ?? { status: 'loading' }}
            lessons={lessons}
            planning={{
              model: milestones,
              timezone: widget.overrides.timezone ?? preferences.filters.timezone,
              certificationIds:
                widget.overrides.certificationIds === undefined
                  ? preferences.filters.certificationIds
                  : widget.overrides.certificationIds,
            }}
            controls={chartPicker}
          />
        ))}
      </div>
    </DashboardTabs>
  );
}
