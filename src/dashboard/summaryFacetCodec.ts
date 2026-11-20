import { dashboardEnum, dashboardRecord, dashboardText } from './codec';
import { dashboardContexts, dashboardFormats, dashboardModes, dashboardPolarities } from './filterCodec';
import { dashboardRevisionNumber } from './summaryGroupCodec';
import { dashboardRows } from './summaryStatsCodec';
import type { DashboardFacets } from './summaryTypes';

export function readDashboardFacets(value: unknown): DashboardFacets {
  const row = dashboardRecord(value, [
    'certificationIds',
    'categories',
    'modes',
    'contexts',
    'formats',
    'polarities',
    'revisions',
    'units',
  ]);
  const strings = (value: unknown, choices?: readonly string[]) =>
    dashboardRows(
      value,
      (item) => (choices ? dashboardEnum(item, choices) : dashboardText(item)),
      (item) => item,
    );
  return {
    certificationIds: strings(row.certificationIds),
    categories: dashboardRows(
      row.categories,
      (item) => {
        const category = dashboardRecord(item, ['certificationId', 'category']);
        return {
          certificationId: dashboardText(category.certificationId, 120),
          category: dashboardText(category.category),
        };
      },
      (item) => JSON.stringify([item.certificationId, item.category]),
    ),
    modes: dashboardRows(
      row.modes,
      (item) => dashboardEnum(item, dashboardModes),
      (item) => item,
    ),
    contexts: dashboardRows(
      row.contexts,
      (item) => dashboardEnum(item, dashboardContexts),
      (item) => item,
    ),
    formats: dashboardRows(
      row.formats,
      (item) => dashboardEnum(item, dashboardFormats),
      (item) => item,
    ),
    polarities: dashboardRows(
      row.polarities,
      (item) => dashboardEnum(item, dashboardPolarities),
      (item) => item,
    ),
    revisions: dashboardRows(
      row.revisions,
      (item) => {
        const revision = dashboardRecord(item, ['sourceVersion', 'questionRevision']);
        return {
          sourceVersion: dashboardText(revision.sourceVersion, 128),
          questionRevision: dashboardRevisionNumber(revision.questionRevision),
        };
      },
      (item) => JSON.stringify([item.sourceVersion, item.questionRevision]),
    ),
    units: dashboardRows(
      row.units,
      (item) => {
        const unit = dashboardRecord(item, ['unitId', 'contentVersion']);
        return {
          unitId: dashboardText(unit.unitId, 120),
          contentVersion: dashboardText(unit.contentVersion, 128),
        };
      },
      (item) => JSON.stringify([item.unitId, item.contentVersion]),
    ),
  };
}
