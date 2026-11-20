import { dashboardFacets } from './aggregateFacets';
import { dashboardReview } from './aggregateReviews';
import { dashboardDuration, dashboardGroups, dashboardStats } from './aggregateStats';
import { dashboardDateLabel, dashboardEventMatches } from './eventScope';
import type { DashboardRecords } from './eventTypes';
import { readDashboardQuery } from './query';
import type { DashboardQuery } from './queryTypes';
import type { DashboardSummary } from './summaryTypes';

export function aggregateDashboard(records: DashboardRecords, value: DashboardQuery): DashboardSummary {
  const query = readDashboardQuery(value);
  const events = records.events.filter((event) => dashboardEventMatches(event, query));
  const named = (key: 'certificationId' | 'mode' | 'context' | 'format' | 'polarity') =>
    dashboardGroups(events, (event) => ({ key: event[key] }));
  return {
    schemaVersion: 1,
    query,
    total: dashboardStats(events),
    daily: dashboardGroups(events, (event) => ({
      date: dashboardDateLabel(event.answeredAt, query.range.timezone),
    })),
    groups: {
      certifications: named('certificationId'),
      categories: dashboardGroups(
        events,
        ({ certificationId, category, sourceVersion, questionRevision }) => ({
          certificationId,
          category,
          sourceVersion,
          questionRevision,
        }),
      ),
      modes: named('mode'),
      contexts: named('context'),
      formats: named('format'),
      polarities: named('polarity'),
      revisions: dashboardGroups(events, ({ sourceVersion, questionRevision }) => ({
        sourceVersion,
        questionRevision,
      })),
      units: dashboardGroups(
        events.filter((event) => event.unitId !== null && event.contentVersion !== null),
        (event) => ({ unitId: event.unitId as string, contentVersion: event.contentVersion as string }),
      ),
    },
    duration: dashboardDuration(events),
    review: dashboardReview(events),
    exams: records.exams.flatMap((exam) => {
      const scoped = events.filter((event) => event.examId === exam.examId);
      return scoped.length
        ? [
            {
              ...exam,
              stats: dashboardStats(scoped),
              allAnswers: dashboardStats(records.events.filter((event) => event.examId === exam.examId)),
            },
          ]
        : [];
    }),
    lessonFinals: records.lessonFinals.flatMap((session) => {
      const scoped = events.filter((event) => event.sessionId === session.sessionId);
      return scoped.length
        ? [
            {
              ...session,
              stats: dashboardStats(scoped),
              allAnswers: dashboardStats(
                records.events.filter((event) => event.sessionId === session.sessionId),
              ),
            },
          ]
        : [];
    }),
    facets: dashboardFacets(records.events),
  };
}
