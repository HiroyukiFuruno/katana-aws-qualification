import { isGenerationConflict } from '../../progress/errors';
import type { BrowserStorage } from '../../progress/guest';
import type { ProgressRpcClient } from '../../progress/types';
import type { DeliveryUnitAsset } from '../delivery/artifactTypes';
import type { LessonAssets } from '../delivery/assets';
import { createGuestLessonRepository, type LessonLearningRepository } from './guestRepository';
import { readArchivedLessonRecords } from './archivedRecords';
import { GuestLessonStorage } from './guestStorage';
import { guestLessonSummaries } from './guestSummary';
import { createMemberLessonRepository } from './memberRepository';
import { createLessonOutbox } from './outbox';
import type { LessonCommand } from './outboxTypes';

type Input = {
  assets: LessonAssets;
  storage: BrowserStorage;
  isCurrent: () => boolean;
  member?: { userId: string; client: ProgressRpcClient };
};

function guestExecute(
  repository: LessonLearningRepository,
  asset: DeliveryUnitAsset,
  command: LessonCommand,
) {
  if (command.kind === 'recordStep') return repository.recordStep(asset, command.input);
  if (command.kind === 'startFinal') return repository.startFinal(asset, command.input);
  if (command.kind === 'saveResponse') return repository.saveResponse(asset, command.input);
  return repository.finalize(asset, command.input);
}

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
          resolveAsset: (unitId, version) => assets.unit(unitId, version),
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
      return outbox ? outbox.execute(asset, command) : guestExecute(repository, asset, command);
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
    async archivedRecords() {
      await initialize();
      return readArchivedLessonRecords(
        assets,
        async (index) => {
          if (memberRepository)
            return readCurrent(() =>
              memberRepository.summaries(
                index.units.map(({ unitId, contentVersion }) => ({ unitId, contentVersion })),
              ),
            );
          if (!guest) throw new Error('Guest lesson repository is unavailable.');
          return guestLessonSummaries(index, assets, guest);
        },
        outbox,
      );
    },
    dispose: () => guest?.dispose(),
  };
}

export type LessonServices = ReturnType<typeof createLessonServices>;
