import type { ReactNode } from 'react';
import type { usePreferences } from '../../preferences';
import type { DashboardWidget } from '../preferenceTypes';
import type { DashboardDataState, DashboardViewProps } from '../viewTypes';
import { DashboardVisual } from '../visual/DashboardVisual';
import { FilterCaption } from '../visual/FilterCaption';
import { LessonPanel } from '../visual/LessonPanel';
import { OverviewPanel } from '../visual/OverviewPanel';
import { ReviewPanel } from '../visual/ReviewPanel';
import { SessionPanel } from '../visual/SessionPanel';

export function DashboardWidgetState({
  state,
  widget,
  lessons,
  t,
}: {
  state: DashboardDataState;
  widget: DashboardWidget;
  lessons: DashboardViewProps['lessons'];
  t: ReturnType<typeof usePreferences>['t'];
}) {
  if (state.status === 'loading') return <p role="status">{t('dashboardLoading')}</p>;
  if (state.status === 'error')
    return (
      <div>
        <p role="alert">{t('dashboardError')}</p>
        <button type="button" onClick={state.retry}>
          {t('progressRetry')}
        </button>
      </div>
    );
  const items = lessons.status === 'ready' ? lessons.items : [];
  let content: ReactNode;
  if (widget.kind === 'overview') content = <OverviewPanel total={state.summary.total} />;
  else if (widget.kind === 'lessons')
    content = (
      <LessonPanel widget={widget} query={state.summary.query} lessons={lessons} retry={state.retry} />
    );
  else if (widget.kind === 'reviews')
    content = state.summary.review.length ? (
      <ReviewPanel
        widget={widget}
        review={state.summary.review}
        timezone={state.summary.query.range.timezone}
        lessons={items}
      />
    ) : (
      <p>{t('dashboardNoData')}</p>
    );
  else if (widget.kind === 'exams')
    content =
      state.summary.exams.length || state.summary.lessonFinals.length ? (
        <SessionPanel widget={widget} summary={state.summary} lessons={items} />
      ) : (
        <p>{t('dashboardNoData')}</p>
      );
  else
    content = (
      <>
        {state.summary.total.answered === 0 && <p>{t('dashboardNoData')}</p>}
        <DashboardVisual widget={widget} summary={state.summary} lessons={items} />
      </>
    );
  return (
    <>
      {state.excludedRecords > 0 && (
        <p className="notice" role="status">
          {t('dashboardExcludedRecords', { count: state.excludedRecords })}
        </p>
      )}
      {content}
      <FilterCaption
        query={state.summary.query}
        lessons={items}
        currentProgress={widget.kind === 'lessons'}
      />
    </>
  );
}
