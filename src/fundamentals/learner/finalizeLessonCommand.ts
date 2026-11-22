import type { LessonCommand } from '../state/outboxTypes';
import type { LessonSnapshot } from '../state/types';

type CommandBase = Pick<LessonCommand, 'commandId' | 'contentVersion' | 'unitId'>;

export function finalizeLessonCommand(snapshot: LessonSnapshot, command: CommandBase): LessonCommand {
  const session = snapshot.sessions.find(
    (item) => item.sessionId === snapshot.progress.activeFinalSessionId,
  );
  if (!session) throw new Error('The lesson final session is missing.');
  return {
    ...command,
    kind: 'finalize',
    input: { sessionId: session.sessionId, expectedRevision: session.revision },
  };
}
