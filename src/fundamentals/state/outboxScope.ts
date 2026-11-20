import type { LessonCommand, LessonOutboxScope } from './outboxTypes';

export function pendingLessonCommands(commands: LessonCommand[], scope?: LessonOutboxScope) {
  return commands.filter(
    (command) =>
      !scope || (command.unitId === scope.unitId && command.contentVersion === scope.contentVersion),
  );
}
