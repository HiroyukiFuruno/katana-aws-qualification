import { failure, localFailure } from './slots.ts';
import type { RuntimeContext, RuntimeRepository } from './types.ts';

export async function ensureLive(
  now: () => number,
  context: RuntimeContext,
  terminated: () => boolean,
  repository: RuntimeRepository,
): Promise<void> {
  const first = now();
  if (terminated() || first >= context.expiresAt) throw failure(terminated() ? 'terminal' : 'expired');
  try {
    if (await repository.isTerminal(context.legId)) throw failure('terminal');
  } catch (error) {
    throw localFailure(error) ?? failure('repository_failed');
  }
  const second = now();
  if (terminated() || second >= context.expiresAt) throw failure(terminated() ? 'terminal' : 'expired');
}
