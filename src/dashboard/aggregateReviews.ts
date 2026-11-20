import type { DashboardEvent } from './eventTypes';
import type { DashboardReview } from './summaryTypes';

export function dashboardReview(events: DashboardEvent[]): DashboardReview[] {
  const groups = new Map<string, DashboardEvent[]>();
  for (const event of events) {
    if (event.mode === 'exam') continue;
    const key = JSON.stringify([
      event.certificationId,
      event.questionId,
      event.questionRevision,
      event.sourceVersion,
    ]);
    const group = groups.get(key) ?? [];
    group.push(event);
    groups.set(key, group);
  }
  return [...groups.values()]
    .flatMap((group): DashboardReview[] => {
      const ordered = [...group].sort(
        (a, b) =>
          Date.parse(b.answeredAt) - Date.parse(a.answeredAt) ||
          b.eventId.localeCompare(a.eventId, 'en'),
      );
      const latest = ordered[0];
      if (latest.isCorrect) return [];
      return [
        {
          certificationId: latest.certificationId,
          questionId: latest.questionId,
          questionRevision: latest.questionRevision,
          sourceVersion: latest.sourceVersion,
          category: latest.category,
          context: latest.context,
          unitId: latest.unitId,
          contentVersion: latest.contentVersion,
          answered: group.length,
          incorrectCount: group.filter((event) => !event.isCorrect).length,
          latestAnsweredAt: latest.answeredAt,
        },
      ];
    })
    .sort(
      (a, b) =>
        Date.parse(b.latestAnsweredAt) - Date.parse(a.latestAnsweredAt) ||
        a.questionId.localeCompare(b.questionId, 'en'),
    );
}
