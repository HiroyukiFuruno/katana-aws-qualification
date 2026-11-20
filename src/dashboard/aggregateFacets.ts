import type { DashboardEvent } from './eventTypes';
import { dashboardContexts, dashboardFormats, dashboardModes, dashboardPolarities } from './filterCodec';
import type { DashboardFacets } from './summaryTypes';

function unique<T>(values: T[]) {
  return [...new Map(values.map((value) => [JSON.stringify(value), value])).entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, value]) => value);
}

export function dashboardFacets(events: DashboardEvent[]): DashboardFacets {
  return {
    certificationIds: unique(events.map((event) => event.certificationId)),
    categories: unique(events.map(({ certificationId, category }) => ({ certificationId, category }))),
    modes: dashboardModes.filter((mode) => events.some((event) => event.mode === mode)),
    contexts: dashboardContexts.filter((context) => events.some((event) => event.context === context)),
    formats: dashboardFormats.filter((format) => events.some((event) => event.format === format)),
    polarities: dashboardPolarities.filter((polarity) =>
      events.some((event) => event.polarity === polarity),
    ),
    revisions: unique(
      events.map(({ sourceVersion, questionRevision }) => ({ sourceVersion, questionRevision })),
    ),
    units: unique(
      events.flatMap(({ unitId, contentVersion }) =>
        unitId && contentVersion ? [{ unitId, contentVersion }] : [],
      ),
    ),
  };
}
