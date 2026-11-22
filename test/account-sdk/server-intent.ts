import type { Operation } from './control';

export function sourceIntent(operations: Map<string, Operation>) {
  const source = [...operations.values()].find(
    (operation) => operation.side === 'source' && operation.intent,
  );
  if (!source?.intent) throw new Error('source intent is not ready');
  return {
    actor: source.actor,
    intent: source.intent,
    kind: source.kind ?? 'add_existing',
    sourceScope: source.sourceScope,
  };
}

export function verifiedSourceScope(operations: Map<string, Operation>, actor: Operation['actor']) {
  const source = sourceIntent(operations);
  if (source.actor.userId !== actor.userId || source.actor.sessionId !== actor.sessionId)
    throw new Error('source actor does not match target actor');
  if (!source.sourceScope) throw new Error('missing verified source scope');
  return source.sourceScope;
}
