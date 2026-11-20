import { isGenerationConflict } from '../../progress/errors';
import { withOutboxLock } from '../../progress/retryOutboxStorage';
import type { MemberLessonRepository } from './memberTypes';
import {
  lessonOutboxKey,
  persistLessonOutbox,
  restoreLessonOutbox,
  sameLessonCommand,
  validateLessonCommand,
} from './outboxCodec';
import { invokeLessonCommand, resolveLessonAsset } from './outboxExecutor';
import { pendingLessonCommands } from './outboxScope';
import type {
  LessonAssetResolver,
  LessonCommand,
  LessonOutbox,
  LessonOutboxStorage,
} from './outboxTypes';

type Input = {
  isCurrent: () => boolean;
  repository: MemberLessonRepository;
  resolveAsset: LessonAssetResolver;
  storage: LessonOutboxStorage;
  userId: string;
};

function ownerChanged() {
  throw new Error('Progress owner changed');
}

export function createLessonOutbox(input: Input): LessonOutbox {
  const key = lessonOutboxKey(input.userId);
  let generation: number | undefined;
  let pending: LessonCommand[] = [];
  const invalidated = new Set<string>();
  const current = () => {
    if (!input.isCurrent()) ownerChanged();
  };
  const save = async (removeIds: Iterable<string> = [], allowStaleOwner = false) => {
    if (generation === undefined) throw new Error('Lesson outbox is not initialized');
    await withOutboxLock(key, async () => {
      if (!allowStaleOwner) current();
      persistLessonOutbox(input.storage, key, input.userId, generation as number, pending, removeIds);
    });
  };
  const remove = async (commandId: string, allowStaleOwner = false) => {
    const previous = pending;
    pending = pending.filter((command) => command.commandId !== commandId);
    try {
      await save([commandId], allowStaleOwner);
    } catch (error) {
      pending = previous;
      throw error;
    }
  };
  const discardChangedOwner = async (commandId: string, error: unknown) => {
    try {
      await remove(commandId, true);
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], 'Unable to remove stale lesson command');
    }
    throw error;
  };
  const reconcileGeneration = async () => {
    const staleIds = pending.map((command) => command.commandId);
    const next = await input.repository.initialize();
    current();
    generation = next;
    for (const id of staleIds) invalidated.add(id);
    pending = [];
    await save(staleIds);
  };
  const execute = async (asset: Awaited<ReturnType<typeof resolveLessonAsset>>, raw: LessonCommand) => {
    current();
    let command = validateLessonCommand(raw);
    if (invalidated.has(command.commandId)) throw new Error('Stale lesson command requires reload');
    if (asset.unit.id !== command.unitId || asset.contentVersion !== command.contentVersion) {
      throw new Error('Lesson outbox asset mismatch');
    }
    const existing = pending.find((item) => item.commandId === command.commandId);
    if (existing && !sameLessonCommand(existing, command)) {
      throw new Error('Lesson outbox command conflict.');
    }
    if (existing) command = existing;
    if (!existing) {
      pending = [...pending, command];
      await save();
      try {
        current();
      } catch (error) {
        await discardChangedOwner(command.commandId, error);
      }
    }
    try {
      current();
      const result = await invokeLessonCommand(input.repository, asset, command);
      current();
      await remove(command.commandId);
      current();
      return result;
    } catch (error) {
      if (isGenerationConflict(error)) await reconcileGeneration();
      if (!input.isCurrent()) await discardChangedOwner(command.commandId, error);
      throw error;
    }
  };
  return {
    async initialize() {
      current();
      generation = await input.repository.initialize();
      current();
      pending = await withOutboxLock(key, async () =>
        restoreLessonOutbox(input.storage, key, input.userId, generation as number),
      );
      current();
    },
    execute,
    async flush(scope) {
      for (const command of pendingLessonCommands(pending, scope)) {
        current();
        await execute(await resolveLessonAsset(input.resolveAsset, command), command);
      }
    },
    async clear() {
      pending = [];
      await withOutboxLock(key, async () => input.storage.removeItem(key));
    },
    async discard(commandId) {
      if (pending.some((command) => command.commandId === commandId)) await remove(commandId);
    },
    async discardUnit(unitId, contentVersion) {
      const removeIds = pending
        .filter((command) => command.unitId === unitId && command.contentVersion === contentVersion)
        .map((command) => command.commandId);
      if (!removeIds.length) return;
      const previous = pending;
      pending = pending.filter((command) => !removeIds.includes(command.commandId));
      try {
        await save(removeIds);
      } catch (error) {
        pending = previous;
        throw error;
      }
    },
    hasPending: (scope) => pendingLessonCommands(pending, scope).length > 0,
  };
}
