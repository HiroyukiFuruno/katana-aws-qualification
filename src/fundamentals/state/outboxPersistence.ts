import { withOutboxLock } from '../../progress/retryOutboxStorage';
import { persistLessonOutbox, restoreLessonOutbox } from './outboxCodec';
import type { LessonCommand, LessonOutboxStorage } from './outboxTypes';

type Input = {
  current: () => void;
  generation: () => number | undefined;
  invalidated: Set<string>;
  key: string;
  pending: () => LessonCommand[];
  persistedIds: () => Set<string>;
  refreshGeneration: () => Promise<number>;
  setGeneration: (generation: number) => void;
  setPending: (commands: LessonCommand[]) => void;
  setPersistedIds: (ids: Set<string>) => void;
  storage: LessonOutboxStorage;
  userId: string;
};

export function createOutboxPersistence(input: Input) {
  async function save(
    additions: LessonCommand[] = [],
    removeIds: Iterable<string> = [],
    allowStaleOwner = false,
  ) {
    const generation = input.generation();
    if (generation === undefined) throw new Error('Lesson outbox is not initialized');
    await withOutboxLock(input.key, async () => {
      if (!allowStaleOwner) input.current();
      const next = persistLessonOutbox(
        input.storage,
        input.key,
        input.userId,
        generation,
        additions,
        removeIds,
      );
      input.setPending(next);
      input.setPersistedIds(new Set(next.map((command) => command.commandId)));
    });
  }

  async function synchronize() {
    const generation = input.generation();
    if (generation === undefined) throw new Error('Lesson outbox is not initialized');
    await withOutboxLock(input.key, async () => {
      input.current();
      let shared: LessonCommand[];
      try {
        shared = restoreLessonOutbox(input.storage, input.key, input.userId, generation);
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === 'Lesson outbox is newer than the server generation.'
        ) {
          throw Object.assign(new Error('Lesson outbox generation changed.'), { code: 'PT409' });
        }
        throw error;
      }
      const sharedIds = new Set(shared.map((command) => command.commandId));
      for (const id of input.persistedIds()) {
        if (!sharedIds.has(id)) input.invalidated.add(id);
      }
      const unsaved = input.pending().filter((command) => !input.persistedIds().has(command.commandId));
      input.setPending([...shared, ...unsaved]);
      input.setPersistedIds(sharedIds);
    });
  }

  async function removeMany(commandIds: string[], allowStaleOwner = false) {
    const previous = input.pending();
    input.setPending(previous.filter((command) => !commandIds.includes(command.commandId)));
    const additions = input.pending().filter((command) => !input.persistedIds().has(command.commandId));
    try {
      await save(additions, commandIds, allowStaleOwner);
    } catch (error) {
      input.setPending(previous);
      throw error;
    }
  }

  const remove = (commandId: string, allowStaleOwner = false) =>
    removeMany([commandId], allowStaleOwner);

  async function reconcile() {
    const staleIds = input.pending().map((command) => command.commandId);
    const next = await input.refreshGeneration();
    input.current();
    input.setGeneration(next);
    for (const id of staleIds) input.invalidated.add(id);
    input.setPending([]);
    await save([], staleIds);
  }

  return { reconcile, remove, removeMany, save, synchronize };
}
