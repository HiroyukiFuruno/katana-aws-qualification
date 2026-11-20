import { dashboardRecord } from './codec';
import { dashboardContexts, dashboardFormats, dashboardModes, dashboardPolarities } from './filterCodec';
import { dashboardQueryKey, readDashboardQuery } from './query';
import type { DashboardQuery } from './queryTypes';
import { readDashboardDuration } from './summaryDurationCodec';
import { readDashboardFacets } from './summaryFacetCodec';
import { readDashboardDaily, readDashboardGroups } from './summaryGroupCodec';
import { readDashboardReviews } from './summaryReviewCodec';
import { readDashboardExams, readDashboardLessonFinals } from './summarySessionCodec';
import { assertDashboardSum, readDashboardStats } from './summaryStatsCodec';
import type { DashboardSummary } from './summaryTypes';

export function readDashboardSummary(raw: unknown, expectedQuery: DashboardQuery): DashboardSummary {
  const row = dashboardRecord(raw, [
    'schemaVersion',
    'query',
    'total',
    'daily',
    'groups',
    'duration',
    'review',
    'exams',
    'lessonFinals',
    'facets',
  ]);
  if (row.schemaVersion !== 1) throw new Error('Unsupported dashboard summary version.');
  const query = readDashboardQuery(row.query);
  if (dashboardQueryKey(query) !== dashboardQueryKey(expectedQuery))
    throw new Error('Dashboard query mismatch.');
  const total = readDashboardStats(row.total);
  const daily = readDashboardDaily(row.daily);
  const groups = readDashboardGroups(row.groups);
  assertDashboardSum(total, daily);
  for (const [key, group] of Object.entries(groups)) assertDashboardSum(total, group, key === 'units');
  for (const [group, choices] of [
    [groups.modes, dashboardModes],
    [groups.contexts, dashboardContexts],
    [groups.formats, dashboardFormats],
    [groups.polarities, dashboardPolarities],
  ] as const) {
    if (group.some((item) => !choices.includes(item.key as never)))
      throw new Error('Unknown dashboard grouping key.');
  }
  const exams = readDashboardExams(row.exams);
  const lessonFinals = readDashboardLessonFinals(row.lessonFinals);
  assertDashboardSum(
    total,
    [...exams.map((exam) => exam.stats), ...lessonFinals.map((session) => session.stats)],
    true,
  );
  return {
    schemaVersion: 1,
    query,
    total,
    daily,
    groups,
    duration: readDashboardDuration(row.duration, total.answered),
    review: readDashboardReviews(row.review),
    exams,
    lessonFinals,
    facets: readDashboardFacets(row.facets),
  };
}
