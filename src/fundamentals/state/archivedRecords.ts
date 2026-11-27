import type { Locale } from '../../locales';
import type { BrowserStorage } from '../../progress/guest';
import type { DeliveryIndexAsset } from '../delivery/artifactTypes';
import type { LessonAssets } from '../delivery/assets';
import type { LessonRecordAsset } from '../delivery/recordAsset';
import type { GuestLessonStorage } from './guestStorage';
import { guestLessonSummary } from './guestSummary';
import type { LessonSummary } from './memberTypes';
import type { LessonOutbox, LessonOutboxScope } from './outboxTypes';

export type ArchivedLessonRecord = {
  unit: { unitId: string; contentVersion: string; title: string };
  summary: LessonSummary;
  pending: boolean;
};

function sameLessonReference(left: LessonOutboxScope, right: LessonOutboxScope) {
  return left.unitId === right.unitId && left.contentVersion === right.contentVersion;
}

function emptyLessonRecordSummary(asset: LessonRecordAsset): LessonSummary {
  return {
    unitId: asset.unit.id,
    contentVersion: asset.contentVersion,
    completedSlides: 0,
    completedCheckpoints: 0,
    totalSlides: asset.steps.length - asset.checkpoints.length - asset.finalQuestions.length,
    totalCheckpoints: asset.checkpoints.length,
    activeFinalSessionId: null,
    passedAt: null,
    latestScore: null,
    requiredScore: null,
  };
}

function archivedLessonRecords(
  current: DeliveryIndexAsset,
  summaries: LessonSummary[],
  pending: LessonOutboxScope[],
): ArchivedLessonRecord[] {
  const titles = new Map(current.units.map(({ unitId, title }) => [unitId, title]));
  return summaries.flatMap((summary) => {
    const hasPending = pending.some((reference) => sameLessonReference(reference, summary));
    if (
      !hasPending &&
      !summary.completedSlides &&
      !summary.completedCheckpoints &&
      !summary.activeFinalSessionId &&
      summary.latestScore === null &&
      !summary.passedAt
    )
      return [];
    const { unitId, contentVersion } = summary;
    return [
      {
        unit: { unitId, contentVersion, title: titles.get(unitId) ?? unitId },
        summary,
        pending: hasPending,
      },
    ];
  });
}

type HistoryInput = {
  assets: LessonAssets;
  guest: GuestLessonStorage | null;
  locale: Locale;
  outbox: LessonOutbox | null;
  storage: BrowserStorage;
  savedSummaries?: (current: LessonOutboxScope[]) => Promise<LessonSummary[]>;
};

export async function readArchivedLessonRecords({
  assets,
  guest,
  locale,
  outbox,
  storage,
  savedSummaries,
}: HistoryInput) {
  const index = await assets.index(locale);
  const current = index.units.map(({ unitId, contentVersion }) => ({ unitId, contentVersion }));
  const isArchived = (reference: LessonOutboxScope) =>
    !current.some((item) => sameLessonReference(item, reference));
  const record = async ({ unitId, contentVersion }: LessonOutboxScope) => {
    const asset = await assets.record(unitId, contentVersion, locale, storage);
    if (!asset) throw new Error('Lesson history data is missing.');
    return asset;
  };
  const pending = outbox?.pendingReferences().filter(isArchived) ?? [];
  if (savedSummaries) {
    const saved = await savedSummaries(current);
    const pendingOnly = pending.filter((item) => !saved.some((row) => sameLessonReference(row, item)));
    const queued = await Promise.all(
      pendingOnly.map(async (reference) => emptyLessonRecordSummary(await record(reference))),
    );
    return archivedLessonRecords(index, [...saved, ...queued], pending);
  }
  if (!guest) throw new Error('Guest lesson repository is unavailable.');
  const saved = await Promise.all(
    guest
      .references()
      .filter(isArchived)
      .map(async (reference) => guestLessonSummary(await record(reference), guest)),
  );
  return archivedLessonRecords(index, saved, []);
}
