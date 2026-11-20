import type { DashboardWidget } from '../preferenceTypes';
import type { DashboardDimensions, DashboardFilters } from '../queryTypes';

export type DashboardOverrideKey = 'period' | 'timezone' | keyof DashboardDimensions;
export function updateWidgetOverride<K extends DashboardOverrideKey>(
  widget: DashboardWidget,
  key: K,
  value: DashboardFilters[K] | undefined,
): DashboardWidget {
  const overrides = { ...widget.overrides } as Partial<DashboardFilters>;
  if (value === undefined) delete overrides[key];
  else Object.assign(overrides, { [key]: value });
  return { ...widget, overrides };
}
export function overrideMode(
  widget: DashboardWidget,
  key: DashboardOverrideKey,
): 'inherit' | 'all' | 'custom' {
  if (!Object.hasOwn(widget.overrides, key)) return 'inherit';
  return widget.overrides[key] === null ? 'all' : 'custom';
}
