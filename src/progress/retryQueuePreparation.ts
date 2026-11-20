import type { Attempt } from '../attempts';

export type QueuePreparation = Attempt | { attempt: Attempt; rethrow: unknown };

export function preparedAttempt(preparation: QueuePreparation) {
  return 'attempt' in preparation ? preparation.attempt : preparation;
}

export function preparationError(preparation: QueuePreparation) {
  return 'rethrow' in preparation ? preparation.rethrow : undefined;
}
