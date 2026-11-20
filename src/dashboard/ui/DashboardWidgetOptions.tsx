import { usePreferences } from '../../preferences';
import type { DashboardWidget } from '../preferenceTypes';
import type { DashboardFilters } from '../queryTypes';
import type { DashboardFacets } from '../summaryTypes';
import { DashboardOverrideSelect } from './DashboardOverrideSelect';
import { dashboardFilterOptions } from './dashboardFilterOptions';
import { type DashboardOverrideKey, updateWidgetOverride } from './dashboardWidgetOverrides';

type Props = {
  widget: DashboardWidget;
  facets?: DashboardFacets;
  onChange: (widget: DashboardWidget) => void;
};
export function DashboardWidgetOptions({ widget, facets, onChange }: Props) {
  const { t } = usePreferences();
  const labels: Record<string, Parameters<typeof t>[0]> = {
    certificationIds: 'dashboardCertification',
    categories: 'dashboardCategory',
    modes: 'dashboardMode',
    contexts: 'dashboardContext',
    formats: 'dashboardFormat',
    polarities: 'dashboardPolarity',
    revisions: 'dashboardRevision',
    unitIds: 'dashboardUnit',
  };
  const filterOptions = dashboardFilterOptions(facets, {
    period: '30d',
    timezone: 'UTC',
    certificationIds: null,
    categories: null,
    modes: null,
    contexts: null,
    formats: null,
    polarities: null,
    revisions: null,
    unitIds: null,
  });
  const values: Record<string, string[]> = {
    period: ['7d', '30d', '90d', 'all'],
    certificationIds: filterOptions.certificationIds,
    categories: filterOptions.categories,
    modes: filterOptions.modes,
    contexts: filterOptions.contexts,
    formats: filterOptions.formats,
    polarities: filterOptions.polarities,
    revisions: filterOptions.revisions,
    unitIds: filterOptions.units,
  };
  for (const key of Object.keys(values)) {
    const current = widget.overrides[key as keyof typeof widget.overrides];
    if (Array.isArray(current))
      values[key] = [
        ...new Set([
          ...values[key],
          ...current.map((item) => (typeof item === 'string' ? item : JSON.stringify(item))),
        ]),
      ];
  }
  return (
    <div className="dashboard-widget-overrides">
      <label>
        {t('dashboardWidth')}
        <select
          value={widget.width}
          onChange={(event) =>
            onChange({ ...widget, width: event.target.value as DashboardWidget['width'] })
          }
        >
          <option value="normal">{t('dashboardWidthNormal')}</option>
          <option value="wide">{t('dashboardWidthWide')}</option>
        </select>
      </label>
      {widget.kind === 'formats' && (
        <label>
          {t('dashboardDimension')}
          <select
            value={widget.dimension}
            onChange={(event) =>
              onChange({ ...widget, dimension: event.target.value as DashboardWidget['dimension'] })
            }
          >
            <option value="default">{t('dashboardDefault')}</option>
            <option value="polarity">{t('dashboardPolarity')}</option>
          </select>
        </label>
      )}
      {(
        [
          'period',
          'timezone',
          'certificationIds',
          'categories',
          'modes',
          'contexts',
          'formats',
          'polarities',
          'revisions',
          'unitIds',
        ] as DashboardOverrideKey[]
      ).map((key) =>
        key === 'timezone' ? (
          <label key={key}>
            {t('dashboardTimezone')}
            <input
              value={typeof widget.overrides.timezone === 'string' ? widget.overrides.timezone : ''}
              placeholder={t('dashboardInherit')}
              onChange={(event) =>
                onChange(updateWidgetOverride(widget, key, event.target.value || undefined))
              }
            />
          </label>
        ) : key === 'period' ? (
          <label key={key}>
            {t('dashboardPeriod')}
            <select
              value={typeof widget.overrides.period === 'string' ? widget.overrides.period : ''}
              onChange={(event) =>
                onChange(
                  updateWidgetOverride(
                    widget,
                    key,
                    event.target.value ? (event.target.value as DashboardFilters['period']) : undefined,
                  ),
                )
              }
            >
              <option value="">{t('dashboardInherit')}</option>
              {values.period.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <DashboardOverrideSelect
            key={key}
            widget={widget}
            keyName={key}
            label={t(labels[key])}
            values={values[key]}
            onChange={onChange}
          />
        ),
      )}
    </div>
  );
}
