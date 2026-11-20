import { usePreferences } from '../../preferences';
import type { DashboardWidget } from '../preferenceTypes';
import type { DashboardFilters } from '../queryTypes';
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
  onChange,
}: {
  widget: DashboardWidget;
  keyName: Exclude<DashboardOverrideKey, 'period' | 'timezone'>;
  label: string;
  values: string[];
  onChange: (widget: DashboardWidget) => void;
}) {
  const { t } = usePreferences();
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
            {dashboardOptionLabel(keyName, item, t)}
          </option>
        ))}
      </select>
      <span className="dashboard-override-mode">{t(modeKeys[overrideMode(widget, keyName)])}</span>
      <button type="button" onClick={() => onChange(updateWidgetOverride(widget, keyName, undefined))}>
        {t('dashboardInherit')}
      </button>
      <button type="button" onClick={() => onChange(updateWidgetOverride(widget, keyName, null))}>
        {t('dashboardAll')}
      </button>
    </label>
  );
}
