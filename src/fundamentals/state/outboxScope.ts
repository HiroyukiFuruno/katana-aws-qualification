import type { LessonCommand, LessonOutboxScope } from './outboxTypes';

export function pendingLessonCommands(commands: LessonCommand[], scope?: LessonOutboxScope) {
  return commands.filter(
    (command) =>
      !scope || (command.unitId === scope.unitId && command.contentVersion === scope.contentVersion),
  );
}

export function pendingLessonReferences(commands: LessonCommand[]): LessonOutboxScope[] {
  const references = new Map<string, LessonOutboxScope>();
  for (const { unitId, contentVersion } of commands) {
    references.set(`${unitId}\u0000${contentVersion}`, { unitId, contentVersion });
  }
  return [...references.values()];
}
