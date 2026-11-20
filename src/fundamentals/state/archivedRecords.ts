import type { DeliveryIndexAsset } from '../delivery/artifactTypes';
import type { LessonAssets } from '../delivery/assets';
import type { LessonSummary } from './memberTypes';
import type { LessonOutbox } from './outboxTypes';

export type ArchivedLessonRecord = {
  unit: DeliveryIndexAsset['units'][number];
  summary: LessonSummary;
  pending: boolean;
  publishedOn?: string;
};

export async function readArchivedLessonRecords(
  assets: LessonAssets,
  summaries: (index: DeliveryIndexAsset) => Promise<LessonSummary[]>,
  outbox: LessonOutbox | null,
): Promise<ArchivedLessonRecord[]> {
  const current = await assets.index();
  const currentVersions = new Map(current.units.map((unit) => [unit.unitId, unit.contentVersion]));
  const seen = new Set<string>();
  const records: ArchivedLessonRecord[] = [];
  for (const edition of (await assets.editions()).slice(1)) {
    const units = edition.index.units.filter((unit) => {
      const key = `${unit.unitId}\u0000${unit.contentVersion}`;
      if (currentVersions.get(unit.unitId) === unit.contentVersion || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (!units.length) continue;
    const rows = await summaries({ ...edition.index, units });
    for (const unit of units) {
      const summary = rows.find(
        (row) => row.unitId === unit.unitId && row.contentVersion === unit.contentVersion,
      );
      if (!summary) throw new Error('Archived lesson summary is missing');
      const pending = outbox?.hasPending(unit) ?? false;
      if (
        pending ||
        summary.completedSlides ||
        summary.completedCheckpoints ||
        summary.activeFinalSessionId ||
        summary.latestScore !== null ||
        summary.passedAt
      )
        records.push({ unit, summary, pending, publishedOn: edition.publishedOn });
    }
  }
  return records;
}
