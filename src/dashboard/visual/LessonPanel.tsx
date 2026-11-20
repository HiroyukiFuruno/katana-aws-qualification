import { usePreferences } from '../../preferences';
import type { DashboardWidget } from '../preferenceTypes';
import type { DashboardQuery } from '../queryTypes';
import type { DashboardViewProps } from '../viewTypes';
import { DashboardDataTable } from './DataTable';
import { DonutChart } from './DonutChart';
import { formatDashboardValue } from './format';
import { ValueBars } from './ValueBars';

export function LessonPanel({
  widget,
  query,
  lessons,
  retry,
}: {
  widget: DashboardWidget;
  query: DashboardQuery;
  lessons: DashboardViewProps['lessons'];
  retry: () => void;
}) {
  const { locale, t } = usePreferences();
  if (lessons.status === 'loading') return <p role="status">{t('dashboardLoading')}</p>;
  if (lessons.status === 'error')
    return (
      <div>
        <p role="alert">{t('dashboardError')}</p>
        <button type="button" onClick={retry}>
          {t('progressRetry')}
        </button>
      </div>
    );
  const units = lessons.items.filter(
    (lesson) =>
      (query.certificationIds === null || query.certificationIds.includes('fundamentals')) &&
      (query.unitIds === null || query.unitIds.includes(lesson.unitId)),
  );
  const caption = t('dashboardLessonScope');
  return (
    <div className="dashboard-viz">
      <p className="dashboard-viz-note">{caption}</p>
      {units.map((lesson) => (
        <div className="dashboard-viz-lesson" key={lesson.unitId}>
          <h3>
            <a href={lesson.href}>{lesson.title}</a>
          </h3>
          {widget.chart === 'ring' ? (
            <DonutChart
              label={`${lesson.title} · ${t('dashboardReadingProgress')}`}
              points={[
                {
                  id: 'completed',
                  label: t('dashboardReadingProgress'),
                  value: lesson.summary.completedSlides,
                },
                {
                  id: 'remaining',
                  label: t('dashboardRemaining'),
                  value: lesson.summary.totalSlides - lesson.summary.completedSlides,
                },
              ]}
              format={(value) => String(value ?? 0)}
            />
          ) : widget.chart === 'bar' ? (
            <ValueBars
              label={lesson.title}
              percent
              points={[
                {
                  id: lesson.unitId,
                  label: t('dashboardReadingProgress'),
                  value: lesson.summary.totalSlides
                    ? (lesson.summary.completedSlides / lesson.summary.totalSlides) * 100
                    : null,
                  correct: 0,
                  incorrect: 0,
                },
              ]}
              format={(value) =>
                formatDashboardValue(value, 'accuracy', locale, t('dashboardNotMeasured'))
              }
            />
          ) : null}
        </div>
      ))}
      <DashboardDataTable
        caption={t('lessonProgress')}
        columns={[
          { id: 'title', label: t('dashboardUnit') },
          { id: 'reading', label: t('dashboardReadingProgress'), numeric: true },
          { id: 'checkpoints', label: t('dashboardCheckpointProgress'), numeric: true },
          { id: 'score', label: t('dashboardLatestScore'), numeric: true },
          { id: 'passed', label: t('dashboardPassStatus') },
        ]}
        rows={units.map((lesson) => ({
          id: lesson.unitId,
          cells: {
            title: lesson.title,
            reading: `${lesson.summary.completedSlides} / ${lesson.summary.totalSlides}`,
            checkpoints: `${lesson.summary.completedCheckpoints} / ${lesson.summary.totalCheckpoints}`,
            score:
              lesson.summary.latestScore === null
                ? t('dashboardNotMeasured')
                : `${lesson.summary.latestScore} / 12`,
            passed: lesson.summary.passedAt
              ? t('lessonPassed')
              : lesson.summary.completedSlides ||
                  lesson.summary.completedCheckpoints ||
                  lesson.summary.activeFinalSessionId
                ? t('dashboardInProgress')
                : t('fundamentalsNotStarted'),
          },
        }))}
      />
    </div>
  );
}
