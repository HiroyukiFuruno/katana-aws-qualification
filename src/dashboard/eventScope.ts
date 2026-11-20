import type { DashboardEvent } from './eventTypes';
import type { DashboardQuery } from './queryTypes';

export function dashboardEventMatches(event: DashboardEvent, query: DashboardQuery) {
  const time = Date.parse(event.answeredAt);
  const { range } = query;
  if (time >= Date.parse(range.to) || (range.from !== null && time < Date.parse(range.from)))
    return false;
  const contains = <T>(values: readonly T[] | null, value: T) =>
    values === null || values.includes(value);
  return (
    contains(query.certificationIds, event.certificationId) &&
    contains(query.categories, event.category) &&
    contains(query.modes, event.mode) &&
    contains(query.contexts, event.context) &&
    contains(query.formats, event.format) &&
    contains(query.polarities, event.polarity) &&
    (query.unitIds === null || (event.unitId !== null && query.unitIds.includes(event.unitId))) &&
    (query.revisions === null ||
      query.revisions.some(
        (revision) =>
          revision.sourceVersion === event.sourceVersion &&
          revision.questionRevision === event.questionRevision,
      ))
  );
}

export function dashboardDateLabel(time: string, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(Date.parse(time));
  return ['year', 'month', 'day']
    .map((type) => parts.find((part) => part.type === type)?.value)
    .join('-');
}
