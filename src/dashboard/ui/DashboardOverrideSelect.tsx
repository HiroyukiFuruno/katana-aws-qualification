import { usePreferences } from '../../preferences';
import { useDashboardDisplayLabels } from '../displayLabels';
import type { DashboardWidget } from '../preferenceTypes';
import type { DashboardFilters } from '../queryTypes';
import type { DashboardLessonData } from '../viewTypes';
import { dashboardOptionLabel } from './dashboardOptionLabels';
import {
  type DashboardOverrideKey,
  overrideMode,
  updateWidgetOverride,
} from './dashboardWidgetOverrides';

export function DashboardOverrideSelect({
  widget,
  keyName,
  label,
  values,
  lessons,
  onChange,
}: {
  widget: DashboardWidget;
  keyName: Exclude<DashboardOverrideKey, 'period' | 'timezone'>;
  label: string;
  values: string[];
  lessons: readonly DashboardLessonData[];
  onChange: (widget: DashboardWidget) => void;
}) {
  const { t } = usePreferences();
  const display = useDashboardDisplayLabels(lessons);
  const current = widget.overrides[keyName];
  const selected = Array.isArray(current)
    ? current.map((item) => (typeof item === 'string' ? item : JSON.stringify(item)))
    : [];
  const apply = (next: string[] | null) =>
    onChange(
      updateWidgetOverride(
        widget,
        keyName,
        keyName === 'revisions' && next
          ? next.map((item) => JSON.parse(item))
          : (next as DashboardFilters[typeof keyName]),
      ),
    );
  const modeKeys = {
    inherit: 'dashboardOverrideInherit',
    all: 'dashboardOverrideAll',
    custom: 'dashboardOverrideCustom',
  } as const;
  return (
    <div className="dashboard-filter-field">
      <label>
        {label}
        <select
          multiple
          value={selected}
          onChange={(event) => {
            const next = [...event.currentTarget.selectedOptions].map((option) => option.value);
            apply(next.length ? next : null);
          }}
        >
          {values.map((item) => (
            <option key={item} value={item}>
              {dashboardOptionLabel(keyName, item, t, display)}
            </option>
          ))}
        </select>
      </label>
      <span className="dashboard-override-mode">{t(modeKeys[overrideMode(widget, keyName)])}</span>
      <button type="button" onClick={() => onChange(updateWidgetOverride(widget, keyName, undefined))}>
        {t('dashboardInherit')}
      </button>
      <button type="button" onClick={() => onChange(updateWidgetOverride(widget, keyName, null))}>
        {t('dashboardAll')}
      </button>
    </div>
  );
}
