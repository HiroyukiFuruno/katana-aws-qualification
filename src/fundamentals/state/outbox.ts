import { isGenerationConflict } from '../../progress/errors';
import { withOutboxLock } from '../../progress/retryOutboxStorage';
import { LessonStateChangedError } from './conflicts';
import type { MemberLessonRepository } from './memberTypes';
import {
  lessonOutboxKey,
  restoreLessonOutbox,
  sameLessonCommand,
  validateLessonCommand,
} from './outboxCodec';
import { invokeLessonCommand, resolveLessonAsset } from './outboxExecutor';
import { createOutboxPersistence } from './outboxPersistence';
import { discardChangedOwner } from './outboxRecovery';
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
export function createLessonOutbox(input: Input): LessonOutbox {
  const key = lessonOutboxKey(input.userId);
  let generation: number | undefined;
  let pending: LessonCommand[] = [];
  let persistedIds = new Set<string>();
  const invalidated = new Set<string>();
  const current = () => {
    if (!input.isCurrent()) throw new Error('Progress owner changed');
  };
  const persistence = createOutboxPersistence({
    current,
    generation: () => generation,
    invalidated,
    key,
    pending: () => pending,
    persistedIds: () => persistedIds,
    setPending: (commands) => {
      pending = commands;
    },
    setPersistedIds: (ids) => {
      persistedIds = ids;
    },
    refreshGeneration: () => input.repository.initialize(),
    setGeneration: (next) => {
      generation = next;
    },
    storage: input.storage,
    userId: input.userId,
  });
  const execute = async (asset: Awaited<ReturnType<typeof resolveLessonAsset>>, raw: LessonCommand) => {
    current();
    let command = validateLessonCommand(raw);
    try {
      await persistence.synchronize();
    } catch (error) {
      if (isGenerationConflict(error)) {
        invalidated.add(command.commandId);
        await persistence.reconcile();
      }
      throw error;
    }
    if (invalidated.has(command.commandId)) throw new LessonStateChangedError();
    if (asset.unit.id !== command.unitId || asset.contentVersion !== command.contentVersion) {
      throw new Error('Lesson outbox asset mismatch');
    }
    const existing = pending.find((item) => item.commandId === command.commandId);
    if (existing && !sameLessonCommand(existing, command)) {
      throw new Error('Lesson outbox command conflict.');
    }
    if (existing) command = existing;
    if (existing && !persistedIds.has(command.commandId)) {
      await persistence.save(pending.filter((item) => !persistedIds.has(item.commandId)));
      command = pending.find((item) => item.commandId === command.commandId) ?? command;
    }
    if (!existing) {
      const additions = pending.filter((item) => !persistedIds.has(item.commandId));
      pending = [...pending, command];
      await persistence.save([...additions, command]);
      try {
        current();
      } catch (error) {
        await discardChangedOwner(persistence.remove, command.commandId, error);
      }
    }
    try {
      current();
      const result = await invokeLessonCommand(input.repository, asset, command);
      current();
      await persistence.remove(command.commandId);
      current();
      return result;
    } catch (error) {
      if (isGenerationConflict(error)) await persistence.reconcile();
      if (!input.isCurrent()) await discardChangedOwner(persistence.remove, command.commandId, error);
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
      persistedIds = new Set(pending.map((command) => command.commandId));
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
      if (pending.some((command) => command.commandId === commandId))
        await persistence.remove(commandId);
    },
    async discardUnit(unitId, contentVersion) {
      const removeIds = pending
        .filter((command) => command.unitId === unitId && command.contentVersion === contentVersion)
        .map((command) => command.commandId);
      if (!removeIds.length) return;
      const previous = pending;
      pending = pending.filter((command) => !removeIds.includes(command.commandId));
      try {
        await persistence.removeMany(removeIds);
      } catch (error) {
        pending = previous;
        throw error;
      }
    },
    hasPending: (scope) => pendingLessonCommands(pending, scope).length > 0,
    isPersisted: persistence.isPersisted,
    hasPersistedPending: persistence.hasPersistedPending,
  };
}
