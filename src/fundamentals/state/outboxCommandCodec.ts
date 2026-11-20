import { integer, object, strings, text, uuid } from './codecPrimitives';
import type { LessonCommand } from './outboxTypes';

function keys(value: Record<string, unknown>, expected: string[]) {
  if (Object.keys(value).length !== expected.length || expected.some((key) => !(key in value))) {
    throw new Error('Invalid lesson outbox.');
  }
}

export function readCommandInput(kind: string, value: unknown): LessonCommand['input'] {
  const row = object(value, 'input');
  if (kind === 'recordStep') {
    keys(
      row,
      'selected' in row
        ? ['durationMs', 'expectedRevision', 'receiptId', 'selected', 'stepId']
        : ['durationMs', 'expectedRevision', 'receiptId', 'stepId'],
    );
    const base = {
      durationMs: integer(row.durationMs, 'durationMs', 86_400_000),
      expectedRevision: integer(row.expectedRevision, 'expectedRevision'),
      receiptId: uuid(row.receiptId, 'receiptId'),
      stepId: text(row.stepId, 'stepId'),
    };
    return 'selected' in row ? { ...base, selected: strings(row.selected, 'selected') } : base;
  }
  if (kind === 'startFinal' || kind === 'finalize') {
    keys(row, ['expectedRevision', 'sessionId']);
    return {
      expectedRevision: integer(row.expectedRevision, 'expectedRevision'),
      sessionId: uuid(row.sessionId, 'sessionId'),
    };
  }
  if (kind === 'saveResponse') {
    keys(row, [
      'cursorPosition',
      'durationMs',
      'expectedRevision',
      'position',
      'receiptId',
      'selected',
      'sessionId',
    ]);
    return {
      cursorPosition: integer(row.cursorPosition, 'cursorPosition'),
      durationMs: integer(row.durationMs, 'durationMs', 86_400_000),
      expectedRevision: integer(row.expectedRevision, 'expectedRevision'),
      position: integer(row.position, 'position'),
      receiptId: uuid(row.receiptId, 'receiptId'),
      selected: strings(row.selected, 'selected'),
      sessionId: uuid(row.sessionId, 'sessionId'),
    };
  }
  throw new Error('Invalid lesson outbox.');
}
