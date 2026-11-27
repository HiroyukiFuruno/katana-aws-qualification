import type { Locale } from '../../locales';
import { isGenerationConflict } from '../../progress/errors';
import type { BrowserStorage } from '../../progress/guest';
import type { ProgressRpcClient } from '../../progress/types';
import type { DeliveryUnitAsset } from '../delivery/artifactTypes';
import type { LessonAssets } from '../delivery/assets';
import { retainLessonRecord } from '../delivery/recordStorage';
import { readArchivedLessonRecords } from './archivedRecords';
import { compatibleLessonSelections } from './compatibleSelections';
import { createGuestLessonRepository } from './guestRepository';
import { GuestLessonStorage } from './guestStorage';
import { guestLessonSummaries } from './guestSummary';
import { createMemberLessonRepository } from './memberRepository';
import { createLessonOutbox } from './outbox';
import { invokeLessonCommand } from './outboxExecutor';
import type { LessonCommand, LessonOutboxScope } from './outboxTypes';

type Input = {
  assets: LessonAssets;
  storage: BrowserStorage;
  isCurrent: () => boolean;
  member?: { userId: string; client: ProgressRpcClient };
};

export function createLessonServices({ assets, storage, isCurrent, member }: Input) {
  const guest = member ? null : new GuestLessonStorage(storage, isCurrent);
  const memberRepository = member
    ? createMemberLessonRepository({ client: member.client, isCurrent })
    : null;
  const repository = memberRepository ?? (guest && createGuestLessonRepository(guest));
  if (!repository) throw new Error('Lesson repository is unavailable.');
  const outbox =
    member && memberRepository
      ? createLessonOutbox({
          storage,
          userId: member.userId,
          repository: memberRepository,
          resolveAsset: (unitId, version) => assets.record(unitId, version, 'ja', storage),
          isCurrent,
        })
      : null;
  let initializing: Promise<void> | undefined;
  const initialize = () => {
    if (!initializing) {
      const pending = outbox?.initialize() ?? Promise.resolve();
      initializing = pending;
      void pending.catch(() => {
        if (initializing === pending) initializing = undefined;
      });
    }
    return initializing;
  };
  async function readCurrent<T>(read: () => Promise<T>) {
    try {
      return await read();
    } catch (cause) {
      if (isGenerationConflict(cause) && outbox) {
        try {
          await outbox.initialize();
        } catch (recovery) {
          throw new AggregateError([cause, recovery], 'Lesson generation refresh failed.');
        }
      }
      throw cause;
    }
  }
  return {
    assets,
    guest,
    outbox,
    async load(asset: DeliveryUnitAsset) {
      await initialize();
      await outbox?.flush({ unitId: asset.unit.id, contentVersion: asset.contentVersion });
      return readCurrent(() => repository.load(asset));
    },
    async execute(asset: DeliveryUnitAsset, command: LessonCommand) {
      await initialize();
      if (!outbox) return invokeLessonCommand(repository, asset, command);
      if (!isCurrent()) throw new Error('Lesson progress owner changed.');
      retainLessonRecord(storage, asset);
      return outbox.execute(asset, command);
    },
    async loadSaved(asset: DeliveryUnitAsset) {
      await initialize();
      await outbox?.discardUnit(asset.unit.id, asset.contentVersion);
      return readCurrent(() => repository.load(asset));
    },
    async summaries() {
      const index = await assets.index();
      await initialize();
      if (memberRepository) {
        return readCurrent(() =>
          memberRepository.summaries(
            index.units.map(({ unitId, contentVersion }) => ({ unitId, contentVersion })),
          ),
        );
      }
      if (!guest) throw new Error('Guest lesson repository is unavailable.');
      return guestLessonSummaries(index, assets, guest);
    },
    async archivedRecords(locale: Locale) {
      await initialize();
      return readArchivedLessonRecords({
        assets,
        guest,
        locale,
        outbox,
        storage,
        savedSummaries: memberRepository
          ? (current) => readCurrent(() => memberRepository.historySummaries(current))
          : undefined,
      });
    },
    async retryArchivedRecord(reference: LessonOutboxScope) {
      await initialize();
      await outbox?.flush(reference);
    },
    async compatibleSelections(asset: DeliveryUnitAsset) {
      await initialize();
      return compatibleLessonSelections({
        current: asset,
        guest,
        member: memberRepository
          ? {
              load: (record) => readCurrent(() => memberRepository.load(record)),
              checkpointSelection: (record, question) =>
                readCurrent(() => memberRepository.checkpointSelection(record, question)),
            }
          : undefined,
      });
    },
    async reloadArchivedRecord(reference: LessonOutboxScope) {
      await initialize();
      await outbox?.discardUnit(reference.unitId, reference.contentVersion);
    },
    dispose: () => guest?.dispose(),
  };
}

export type LessonServices = ReturnType<typeof createLessonServices>;
