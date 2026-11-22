import { usePreferences } from '../../preferences';
import { useDashboardDisplayLabels } from '../displayLabels';
import type { DashboardFilters } from '../queryTypes';
import type { DashboardFacets } from '../summaryTypes';
import type { DashboardLessonData } from '../viewTypes';
import { dashboardFilterOptions } from './dashboardFilterOptions';
import { dashboardOptionLabel } from './dashboardOptionLabels';

type Props = {
  filters: DashboardFilters;
  facets?: DashboardFacets;
  lessons: readonly DashboardLessonData[];
  onChange: (patch: Partial<DashboardFilters>) => void;
};
export function DashboardFilterFields({ filters, facets, lessons, onChange }: Props) {
  const { t } = usePreferences();
  const display = useDashboardDisplayLabels(lessons);
  const options = dashboardFilterOptions(facets, filters);
  const select = (
    label: string,
    values: string[],
    current: string[] | null,
    change: (next: string[] | null) => void,
    labelValue = (value: string) => value,
  ) => (
    <div className="dashboard-filter-field">
      <label>
        {label}
        <select
          multiple
          value={current ?? []}
          onChange={(event) => {
            const next = [...event.currentTarget.selectedOptions].map((option) => option.value);
            change(next.length ? next : null);
          }}
        >
          {values.map((value) => (
            <option key={value} value={value}>
              {labelValue(value)}
            </option>
          ))}
        </select>
      </label>
      <button type="button" onClick={() => change(null)}>
        {t('dashboardAll')}
      </button>
    </div>
  );
  const enumLabel = (key: string) => (value: string) => dashboardOptionLabel(key, value, t, display);
  return (
    <div className="dashboard-filter-grid dashboard-filter-dimensions">
      {select(
        t('dashboardCertification'),
        options.certificationIds,
        filters.certificationIds,
        (next) => onChange({ certificationIds: next }),
        display.certification,
      )}
      {select(
        t('dashboardCategory'),
        options.categories,
        filters.categories,
        (next) => onChange({ categories: next }),
        display.category,
      )}
      {select(
        t('dashboardMode'),
        options.modes,
        filters.modes,
        (next) => onChange({ modes: next as DashboardFilters['modes'] }),
        enumLabel('modes'),
      )}
      {select(
        t('dashboardContext'),
        options.contexts,
        filters.contexts,
        (next) => onChange({ contexts: next as DashboardFilters['contexts'] }),
        enumLabel('contexts'),
      )}
      {select(
        t('dashboardFormat'),
        options.formats,
        filters.formats,
        (next) => onChange({ formats: next as DashboardFilters['formats'] }),
        enumLabel('formats'),
      )}
      {select(
        t('dashboardPolarity'),
        options.polarities,
        filters.polarities,
        (next) => onChange({ polarities: next as DashboardFilters['polarities'] }),
        enumLabel('polarities'),
      )}
      {select(
        t('dashboardRevision'),
        options.revisions,
        filters.revisions?.map((item) => JSON.stringify(item)) ?? null,
        (next) => onChange({ revisions: next?.map((item) => JSON.parse(item)) ?? null }),
        enumLabel('revisions'),
      )}
      {select(
        t('dashboardUnit'),
        options.units,
        filters.unitIds,
        (next) => onChange({ unitIds: next }),
        display.category,
      )}
    </div>
  );
}
