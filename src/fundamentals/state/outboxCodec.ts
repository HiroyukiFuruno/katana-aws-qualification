import { integer, object, text, uuid } from './codecPrimitives';
import { readCommandInput } from './outboxCommandCodec';
import type { LessonCommand, LessonOutboxStorage } from './outboxTypes';

type Row = { commands: LessonCommand[]; generation: number };

export function lessonOutboxKey(userId: string) {
  return `katana.fundamentals-outbox.v1.${encodeURIComponent(userId)}`;
}

function keys(value: Record<string, unknown>, expected: string[]) {
  if (Object.keys(value).length !== expected.length || expected.some((key) => !(key in value))) {
    throw new Error('Invalid lesson outbox.');
  }
}

export function validateLessonCommand(value: unknown): LessonCommand {
  const row = object(value, 'command');
  keys(row, ['commandId', 'contentVersion', 'input', 'kind', 'unitId']);
  const kind = text(row.kind, 'kind');
  if (!['recordStep', 'startFinal', 'saveResponse', 'finalize'].includes(kind)) {
    throw new Error('Invalid lesson outbox.');
  }
  return {
    commandId: uuid(row.commandId, 'commandId'),
    contentVersion: text(row.contentVersion, 'contentVersion'),
    input: readCommandInput(kind, row.input),
    kind: kind as LessonCommand['kind'],
    unitId: text(row.unitId, 'unitId'),
  } as LessonCommand;
}

export function sameLessonCommand(left: LessonCommand, right: LessonCommand) {
  return JSON.stringify(validateLessonCommand(left)) === JSON.stringify(validateLessonCommand(right));
}

function read(raw: string, userId: string): Row {
  const row = object(JSON.parse(raw), 'outbox');
  keys(row, ['commands', 'generation', 'userId', 'version']);
  if (row.version !== 1 || uuid(row.userId, 'userId') !== userId || !Array.isArray(row.commands)) {
    throw new Error('Invalid lesson outbox.');
  }
  const commands = row.commands.map(validateLessonCommand);
  if (new Set(commands.map((item) => item.commandId)).size !== commands.length) {
    throw new Error('Invalid lesson outbox.');
  }
  return { commands, generation: integer(row.generation, 'generation') };
}

export function restoreLessonOutbox(
  storage: LessonOutboxStorage,
  key: string,
  userId: string,
  generation: number,
) {
  const raw = storage.getItem(key);
  if (raw === null) return [] as LessonCommand[];
  try {
    const row = read(raw, userId);
    if (row.generation < generation) {
      storage.removeItem(key);
      return [];
    }
    if (row.generation > generation)
      throw new Error('Lesson outbox is newer than the server generation.');
    return row.commands;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'Lesson outbox is newer than the server generation.'
    ) {
      throw error;
    }
    throw new Error('教材の未同期データを読み込めませんでした。');
  }
}

export function persistLessonOutbox(
  storage: LessonOutboxStorage,
  key: string,
  userId: string,
  generation: number,
  commands: LessonCommand[],
  removeIds: Iterable<string> = [],
) {
  const raw = storage.getItem(key);
  const existing = raw === null ? undefined : read(raw, userId);
  if (existing && existing.generation !== generation) {
    if (existing.generation < generation) storage.removeItem(key);
    else throw new Error('Lesson outbox is newer than the server generation.');
  }
  const merged = new Map(
    existing?.generation === generation ? existing.commands.map((item) => [item.commandId, item]) : [],
  );
  for (const command of commands) {
    const previous = merged.get(command.commandId);
    if (previous && !sameLessonCommand(previous, command)) {
      throw new Error('Lesson outbox command conflict.');
    }
    merged.set(command.commandId, command);
  }
  for (const id of removeIds) merged.delete(id);
  if (!merged.size) return storage.removeItem(key);
  storage.setItem(
    key,
    JSON.stringify({ commands: [...merged.values()], generation, userId, version: 1 }),
  );
}
