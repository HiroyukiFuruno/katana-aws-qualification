import { usePreferences } from '../../preferences';
import type { DashboardQuery } from '../queryTypes';
import type { DashboardLessonData } from '../viewTypes';
import { dashboardCertificationLabel } from './format';
import { dashboardDimensionLabel } from './labels';

export function FilterCaption({
  query,
  lessons,
}: {
  query: DashboardQuery;
  lessons: readonly DashboardLessonData[];
}) {
  const { locale, t } = usePreferences();
  const date = (time: string) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: query.range.timezone,
    }).format(new Date(time));
  const items: [string, string[] | null][] = [
    [t('dashboardCertification'), query.certificationIds?.map(dashboardCertificationLabel) ?? null],
    [t('dashboardCategory'), query.categories],
    [t('dashboardMode'), query.modes?.map((value) => dashboardDimensionLabel(value, t)) ?? null],
    [t('dashboardContext'), query.contexts?.map((value) => dashboardDimensionLabel(value, t)) ?? null],
    [t('dashboardFormat'), query.formats?.map((value) => dashboardDimensionLabel(value, t)) ?? null],
    [
      t('dashboardPolarity'),
      query.polarities?.map((value) => dashboardDimensionLabel(value, t)) ?? null,
    ],
    [
      t('dashboardRevision'),
      query.revisions?.map((value) => `${value.sourceVersion} / r${value.questionRevision}`) ?? null,
    ],
    [
      t('dashboardUnit'),
      query.unitIds?.map((value) => lessons.find((unit) => unit.unitId === value)?.title ?? value) ??
        null,
    ],
  ];
  return (
    <details className="dashboard-viz-conditions">
      <summary>{t('dashboardConditions')}</summary>
      <p>
        {query.range.from === null ? t('dashboardAllTime') : date(query.range.from)} –{' '}
        {date(new Date(Date.parse(query.range.to) - 1).toISOString())} · {query.range.timezone}
      </p>
      <dl>
        {items.map(([label, values]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{values?.join(' · ') ?? t('dashboardAll')}</dd>
          </div>
        ))}
      </dl>
      <p>{t('dashboardAnswerScope')}</p>
    </details>
  );
}
