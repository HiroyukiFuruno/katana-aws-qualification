import type { ComponentProps } from 'react';
import { usePreferences } from '../../preferences';
import type { DashboardViewProps } from '../viewTypes';
import { DashboardFilterFields } from './DashboardFilterFields';
import { DashboardWidgetPicker } from './DashboardWidgetPicker';

export function DashboardControls(
  props: DashboardViewProps & { facets?: ComponentProps<typeof DashboardFilterFields>['facets'] },
) {
  const { t } = usePreferences();
  const filters = props.preferences.filters;
  const update = (patch: Partial<typeof filters>) =>
    props.onPreferences({ ...props.preferences, filters: { ...filters, ...patch } });
  return (
    <details className="card dashboard-controls dashboard-widget-wide">
      <summary>
        <h2 className="dashboard-controls-title">{t('dashboardCustomize')}</h2>
      </summary>
      <div className="dashboard-filter-grid">
        <label>
          {t('dashboardPeriod')}
          <select
            value={filters.period}
            onChange={(e) => update({ period: e.target.value as typeof filters.period })}
          >
            <option value="7d">{t('dashboard7d')}</option>
            <option value="30d">{t('dashboard30d')}</option>
            <option value="90d">{t('dashboard90d')}</option>
            <option value="all">{t('dashboardAllTime')}</option>
          </select>
        </label>
        <label>
          {t('dashboardTimezone')}
          <input value={filters.timezone} onChange={(e) => update({ timezone: e.target.value })} />
        </label>
      </div>
      <details className="dashboard-advanced-controls">
        <summary>{t('dashboardCustomize')}</summary>
        <DashboardFilterFields filters={filters} facets={props.facets} onChange={update} />
        <DashboardWidgetPicker preferences={props.preferences} onPreferences={props.onPreferences} />
      </details>
      <div className="dashboard-actions">
        <button type="button" onClick={props.onApply}>
          {t('dashboardApply')}
        </button>
        <button type="button" onClick={props.onSave} disabled={!props.dirty || props.saving}>
          {props.saving ? t('dashboardSaving') : t('dashboardSave')}
        </button>
        <button type="button" onClick={props.onReset}>
          {t('dashboardReset')}
        </button>
        <button type="button" onClick={props.onRefresh}>
          {t('progressRetry')}
        </button>
      </div>
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
    </details>
  );
}
