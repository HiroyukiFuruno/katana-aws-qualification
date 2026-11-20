import { type ComponentProps, useState } from 'react';
import { usePreferences } from '../../preferences';
import type { DashboardViewProps } from '../viewTypes';
import { DashboardFilterFields } from './DashboardFilterFields';
import { DashboardTabs } from './DashboardTabs';
import { DashboardWidgetSettings } from './DashboardWidgetSettings';
import { dashboardPeriodKeys } from './dashboardOptionLabels';
import { type DashboardDensity, dashboardDensityKeys } from './dashboardPresentation';

type Props = DashboardViewProps & {
  facets?: ComponentProps<typeof DashboardFilterFields>['facets'];
  density: DashboardDensity;
  onDensity: (density: DashboardDensity) => void;
};

const densityChoices = ['compact', 'standard', 'full'] as const;
const densityHelp = {
  compact: 'dashboardDensityCompactHelp',
  standard: 'dashboardDensityStandardHelp',
  full: 'dashboardDensityFullHelp',
} as const;

export function DashboardControls(props: Props) {
  const { t } = usePreferences();
  const [category, setCategory] = useState('display');
  const [advanced, setAdvanced] = useState(false);
  const filters = props.preferences.filters;
  const update = (patch: Partial<typeof filters>) =>
    props.onPreferences({ ...props.preferences, filters: { ...filters, ...patch } });

  return (
    <details className="card dashboard-controls">
      <summary>{t('dashboardSettings')}</summary>
      <div className="dashboard-settings-body">
        <fieldset className="dashboard-settings-level" aria-label={t('dashboardSettings')}>
          <button type="button" aria-pressed={!advanced} onClick={() => setAdvanced(false)}>
            {t('dashboardSettingsBasic')}
          </button>
          <button type="button" aria-pressed={advanced} onClick={() => setAdvanced(true)}>
            {t('dashboardSettingsAdvanced')}
          </button>
        </fieldset>
        <DashboardTabs
          label={t('dashboardSettings')}
          tabs={[
            { id: 'display', label: t('dashboardSettingsDisplay') },
            { id: 'filters', label: t('dashboardSettingsFilters') },
          ]}
          selected={category}
          onSelect={setCategory}
        >
          {category === 'display' ? (
            advanced ? (
              <DashboardWidgetSettings {...props} />
            ) : (
              <div className="dashboard-filter-grid">
                <label>
                  {t('dashboardDensity')}
                  <select
                    value={props.density}
                    onChange={(event) => {
                      const choice = densityChoices.find((density) => density === event.target.value);
                      if (choice) props.onDensity(choice);
                    }}
                  >
                    {densityChoices.map((choice) => (
                      <option key={choice} value={choice}>
                        {t(dashboardDensityKeys[choice])}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="dashboard-density-help">{t(densityHelp[props.density])}</p>
              </div>
            )
          ) : (
            <div className="dashboard-settings-body">
              {advanced ? (
                <>
                  <div className="dashboard-filter-grid">
                    <label>
                      {t('dashboardTimezone')}
                      <input
                        value={filters.timezone}
                        onChange={(e) => update({ timezone: e.target.value })}
                      />
                    </label>
                  </div>
                  <DashboardFilterFields filters={filters} facets={props.facets} onChange={update} />
                </>
              ) : (
                <div className="dashboard-filter-grid">
                  <label>
                    {t('dashboardPeriod')}
                    <select
                      value={filters.period}
                      onChange={(e) => update({ period: e.target.value as typeof filters.period })}
                    >
                      {Object.entries(dashboardPeriodKeys).map(([value, label]) => (
                        <option key={value} value={value}>
                          {t(label)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
            </div>
          )}
        </DashboardTabs>
        {(category === 'filters' || advanced || props.dirty) && (
          <div className="dashboard-actions">
            <button type="button" onClick={props.onApply}>
              {t('dashboardApply')}
            </button>
            <button type="button" onClick={props.onSave} disabled={!props.dirty || props.saving}>
              {props.saving ? t('dashboardSaving') : t('dashboardSave')}
            </button>
            <button
              type="button"
              onClick={() => {
                props.onReset();
                props.onDensity('standard');
              }}
            >
              {t('dashboardReset')}
            </button>
            <button type="button" onClick={props.onRefresh}>
              {t('progressRetry')}
            </button>
          </div>
        )}
        {props.saveState === 'error' && <p role="alert">{t('dashboardSaveFailed')}</p>}
        {props.saveState === 'conflict' && (
          <p role="alert">
            <button type="button" onClick={props.onReloadSettings}>
              {t('dashboardReloadSettings')}
            </button>
          </p>
        )}
        {props.saveState === 'invalid-stored' && <p role="alert">{t('dashboardInvalidSettings')}</p>}
        {props.saveState === 'saved' && <p role="status">{t('dashboardSaved')}</p>}
      </div>
    </details>
  );
}
