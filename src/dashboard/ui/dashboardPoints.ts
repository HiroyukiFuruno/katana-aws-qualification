import type { DashboardWidget } from '../preferenceTypes';
import type { DashboardStats } from '../statTypes';
import type { DashboardDataState, DashboardViewProps } from '../viewTypes';

export type DashboardPoint = { key: string; stats: DashboardStats };
export function dashboardPoints(
  kind: DashboardWidget['kind'],
  state: DashboardDataState,
): DashboardPoint[] {
  if (state.status !== 'ready') return [];
  const s = state.summary;
  if (kind === 'trend' || kind === 'calendar') return s.daily.map((x) => ({ key: x.date, stats: x }));
  if (kind === 'certifications') return s.groups.certifications.map((x) => ({ key: x.key, stats: x }));
  if (kind === 'categories' || kind === 'relationship')
    return s.groups.categories.map((x) => ({
      key: `${x.certificationId}/${x.category}/${x.sourceVersion}/${x.questionRevision}`,
      stats: x,
    }));
  if (kind === 'modes') return s.groups.modes.map((x) => ({ key: x.key, stats: x }));
  if (kind === 'contexts') return s.groups.contexts.map((x) => ({ key: x.key, stats: x }));
  if (kind === 'formats') return s.groups.formats.map((x) => ({ key: x.key, stats: x }));
  if (kind === 'revisions')
    return s.groups.revisions.map((x) => ({
      key: `${x.sourceVersion}/${x.questionRevision}`,
      stats: x,
    }));
  if (kind === 'exams')
    return s.exams
      .filter((x) => x.submittedAt || x.lastAnsweredAt || x.startedAt)
      .map((x) => ({
        key: `${x.examId}:${x.submittedAt ?? x.lastAnsweredAt ?? x.startedAt}`,
        stats: x.stats,
      }));
  if (kind === 'durations')
    return s.duration.bins.map((x) => ({
      key: `${x.lowerMs}-${x.upperMs ?? '∞'}`,
      stats: {
        answered: x.count,
        correct: x.count,
        accuracy: 1,
        durationMs: x.count,
        meanDurationMs: x.count,
      },
    }));
  if (kind === 'reviews')
    return s.review.map((x) => ({
      key: x.questionId,
      stats: {
        answered: x.answered,
        correct: x.answered - x.incorrectCount,
        accuracy: x.answered ? (x.answered - x.incorrectCount) / x.answered : null,
        durationMs: 0,
        meanDurationMs: null,
      },
    }));
  return [{ key: 'total', stats: s.total }];
}
export function lessonRows(lessons: DashboardViewProps['lessons']) {
  return lessons.status === 'ready' ? lessons.items : [];
}
