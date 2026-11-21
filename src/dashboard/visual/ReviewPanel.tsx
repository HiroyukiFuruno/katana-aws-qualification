import { useEffect, useMemo, useState } from 'react';
import { usePreferences } from '../../preferences';
import { createQuestionResolver } from '../../progress/questionCatalog';
import { dashboardCourseLink, dashboardLessonLink } from '../learningLinks';
import type { DashboardWidget } from '../preferenceTypes';
import type { DashboardReview } from '../summaryTypes';
import type { DashboardLessonData } from '../viewTypes';
import { dashboardChartPageSize, useDashboardDensity } from './DashboardDensity';
import { DashboardDataTable } from './DataTable';
import { DashboardPagePicker } from './PagePicker';
import { ValueBars } from './ValueBars';

const identity = (row: DashboardReview) =>
  JSON.stringify([row.certificationId, row.questionId, row.questionRevision, row.sourceVersion]);
export function ReviewPanel({
  widget,
  review,
  timezone,
  lessons,
}: {
  widget: DashboardWidget;
  review: readonly DashboardReview[];
  timezone: string;
  lessons: readonly DashboardLessonData[];
}) {
  const { locale, t } = usePreferences();
  const [resolve] = useState(createQuestionResolver);
  const [requested, setRequested] = useState(0);
  const [retry, setRetry] = useState(0);
  const [metadata, setMetadata] = useState<{
    scope: object;
    titles: Map<string, string>;
    failed: boolean;
  } | null>(null);
  const density = useDashboardDensity();
  const size = widget.chart === 'bar' && density !== 'full' ? dashboardChartPageSize(density) : 10;
  const pages = Math.max(1, Math.ceil(review.length / size));
  const page = Math.min(requested, pages - 1);
  const scope = useMemo(
    () => ({ rows: review.slice(page * size, (page + 1) * size), retry }),
    [review, page, retry, size],
  );
  useEffect(() => {
    let active = true;
    const queue = [...scope.rows];
    const titles = new Map<string, string>();
    let failed = false;
    const worker = async () => {
      while (queue.length) {
        const row = queue.shift();
        if (!row) return;
        try {
          const result = await resolve(row.questionId, row.questionRevision);
          if (
            result &&
            result.certificationId === row.certificationId &&
            result.question.version === row.sourceVersion
          )
            titles.set(identity(row), result.question.title);
        } catch {
          failed = true;
        }
      }
    };
    void Promise.all(Array.from({ length: Math.min(4, queue.length) }, worker)).then(() => {
      if (active) setMetadata({ scope, titles, failed });
    });
    return () => {
      active = false;
    };
  }, [resolve, scope]);
  const title = (row: DashboardReview) =>
    metadata?.scope === scope ? (metadata.titles.get(identity(row)) ?? row.category) : row.category;
  return (
    <div className="dashboard-viz">
      {metadata?.scope === scope && metadata.failed && (
        <div>
          <p role="alert">{t('dashboardError')}</p>
          <button type="button" onClick={() => setRetry((value) => value + 1)}>
            {t('progressRetry')}
          </button>
        </div>
      )}
      {widget.chart === 'bar' && (
        <ValueBars
          paginate={false}
          points={scope.rows.map((row) => ({
            id: identity(row),
            label: title(row),
            value: row.incorrectCount,
            correct: 0,
            incorrect: row.incorrectCount,
          }))}
          label={t('dashboardMetricIncorrect')}
          format={(value) => String(value ?? 0)}
        />
      )}
      <DashboardDataTable
        primary={widget.chart === 'table'}
        keepInCompact
        caption={t('dashboardWidgetReviews')}
        columns={[
          { id: 'title', label: t('dashboardGroup') },
          { id: 'category', label: t('dashboardCategory') },
          { id: 'revision', label: t('dashboardRevision') },
          { id: 'wrong', label: t('dashboardMetricIncorrect'), numeric: true },
          { id: 'total', label: t('dashboardAnswers'), numeric: true },
          { id: 'latest', label: t('dashboardLastAnsweredAt') },
        ]}
        rows={scope.rows.map((row) => {
          const href =
            row.unitId === null
              ? dashboardCourseLink(row.certificationId, locale, 'review')
              : dashboardLessonLink(row.unitId, row.contentVersion, lessons, locale);
          return {
            id: identity(row),
            cells: {
              title: href ? <a href={href}>{title(row)}</a> : title(row),
              category: row.category,
              revision: t('dashboardRevisionValue', {
                version: row.sourceVersion,
                revision: row.questionRevision,
              }),
              wrong: String(row.incorrectCount),
              total: String(row.answered),
              latest: new Intl.DateTimeFormat(locale, {
                dateStyle: 'medium',
                timeStyle: 'short',
                timeZone: timezone,
              }).format(new Date(row.latestAnsweredAt)),
            },
          };
        })}
      />
      <DashboardPagePicker
        chart={widget.chart === 'bar'}
        page={page}
        pages={pages}
        onChange={setRequested}
      />
    </div>
  );
}
