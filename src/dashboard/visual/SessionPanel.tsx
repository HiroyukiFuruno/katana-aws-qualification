import { useState } from 'react';
import { usePreferences } from '../../preferences';
import type { DashboardWidget } from '../preferenceTypes';
import type { DashboardStats } from '../statTypes';
import type { DashboardSummary } from '../summaryTypes';
import { metricKeys } from '../ui/dashboardLabels';
import type { DashboardLessonData } from '../viewTypes';
import { useDashboardDensity } from './DashboardDensity';
import { DashboardDataTable } from './DataTable';
import { FinalPassRates } from './FinalPassRates';
import { dashboardCertificationLabel, dashboardMetricValue, formatDashboardValue } from './format';
import { TimeChart } from './TimeChart';

type Session = {
  id: string;
  series: string;
  label: string;
  submittedAt: string | null;
  lastAnsweredAt: string | null;
  questionCount: number | null;
  stats: DashboardStats;
  allAnswers: DashboardStats;
  result: string;
};
export function SessionPanel({
  widget,
  summary,
  lessons,
}: {
  widget: DashboardWidget;
  summary: DashboardSummary;
  lessons: readonly DashboardLessonData[];
}) {
  const density = useDashboardDensity();
  const [selected, setSelected] = useState('');
  const { locale, t } = usePreferences();
  const timezone = summary.query.range.timezone;
  const date = (value: string | null) =>
    value === null
      ? t('dashboardUnknownSubmitted')
      : new Intl.DateTimeFormat(locale, {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: timezone,
        }).format(new Date(value));
  const ratio = (stats: DashboardStats) =>
    `${stats.correct} / ${stats.answered} · ${formatDashboardValue(dashboardMetricValue(stats, 'accuracy'), 'accuracy', locale, t('dashboardNotMeasured'))}`;
  const sessions: Session[] = [
    ...summary.exams.map((exam) => ({
      id: exam.examId,
      series: JSON.stringify(['exam', exam.certificationId, exam.sourceVersion]),
      label: `${t('exam')} · ${dashboardCertificationLabel(exam.certificationId)} · ${exam.sourceVersion}`,
      submittedAt: exam.submittedAt,
      lastAnsweredAt: exam.lastAnsweredAt,
      questionCount: exam.questionCount,
      stats: exam.stats,
      allAnswers: exam.allAnswers,
      result: t('dashboardNotMeasured'),
    })),
    ...summary.lessonFinals.map((session) => ({
      id: session.sessionId,
      series: JSON.stringify(['lesson-final', session.unitId, session.contentVersion]),
      label: `${t('dashboardContextFinal')} · ${lessons.find((lesson) => lesson.unitId === session.unitId)?.title ?? session.unitId}`,
      submittedAt: session.submittedAt,
      lastAnsweredAt: null,
      questionCount: session.questionCount,
      stats: session.stats,
      allAnswers: session.allAnswers,
      result: `${session.score} / ${session.questionCount} · ${t(session.passed ? 'lessonPassed' : 'lessonNotPassed')}`,
    })),
  ].sort((a, b) =>
    a.submittedAt === null
      ? b.submittedAt === null
        ? a.id.localeCompare(b.id)
        : 1
      : b.submittedAt === null
        ? -1
        : Date.parse(a.submittedAt) - Date.parse(b.submittedAt) || a.id.localeCompare(b.id),
  );
  const groups = new Map<string, Session[]>();
  for (const session of sessions) {
    if (session.submittedAt === null) continue;
    const group = groups.get(session.series) ?? [];
    group.push(session);
    groups.set(session.series, group);
  }
  const series = [...groups];
  const current = series.find(([key]) => key === selected) ?? series[series.length - 1];
  const displayed = density === 'full' ? series : current ? [current] : [];
  const format = (value: number | null) =>
    formatDashboardValue(value, widget.metric, locale, t('dashboardNotMeasured'));
  return (
    <div className="dashboard-viz">
      {widget.chart !== 'table' && density !== 'full' && series.length > 1 && current && (
        <label className="dashboard-chart-picker">
          {t('dashboardSeries')}
          <select value={current[0]} onChange={(event) => setSelected(event.target.value)}>
            {series.map(([key, group]) => (
              <option key={key} value={key}>
                {group[0].label}
              </option>
            ))}
          </select>
        </label>
      )}
      {widget.chart !== 'table' &&
        displayed.map(([key, group]) => (
          <div key={key}>
            <h3>{group[0].label}</h3>
            <p>
              {t('dashboardScopedAnswers')} · {t(metricKeys[widget.metric])}
            </p>
            <TimeChart
              points={group.map((session) => ({
                id: session.id,
                label: date(session.submittedAt),
                value: dashboardMetricValue(session.stats, widget.metric),
                time: Date.parse(session.submittedAt ?? ''),
              }))}
              label={`${group[0].label} · ${t('dashboardScopedAnswers')}`}
              area={false}
              bar={widget.chart === 'bar'}
              percentage={widget.metric === 'accuracy'}
              format={format}
            />
          </div>
        ))}
      <FinalPassRates sessions={summary.lessonFinals} lessons={lessons} />
      <DashboardDataTable
        primary={widget.chart === 'table' || series.length === 0}
        caption={`${t('dashboardWidgetExams')} · ${timezone}`}
        columns={[
          { id: 'label', label: t('dashboardGroup') },
          { id: 'submitted', label: t('dashboardSubmittedAt') },
          { id: 'answered', label: t('dashboardLastAnsweredAt') },
          { id: 'count', label: t('dashboardQuestionCount'), numeric: true },
          { id: 'scoped', label: t('dashboardScopedAnswers'), numeric: true },
          { id: 'full', label: t('dashboardFullExam'), numeric: true },
          { id: 'duration', label: t('dashboardMetricDuration'), numeric: true },
          { id: 'result', label: t('dashboardPassStatus') },
        ]}
        rows={sessions.map((session) => ({
          id: session.id,
          cells: {
            label: session.label,
            submitted: date(session.submittedAt),
            answered:
              session.lastAnsweredAt === null ? t('dashboardNotMeasured') : date(session.lastAnsweredAt),
            count:
              session.questionCount === null ? t('dashboardNotMeasured') : String(session.questionCount),
            scoped: ratio(session.stats),
            full: ratio(session.allAnswers),
            duration: formatDashboardValue(
              session.stats.durationMs,
              'durationMs',
              locale,
              t('dashboardNotMeasured'),
            ),
            result: session.result,
          },
        }))}
      />
    </div>
  );
}
