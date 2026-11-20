import type { MemberProgressRepository } from './member';
import type { MemberRetryQueue } from './retryQueue';
import type { ProgressStoreInput } from './storeTypes';

export function isGenerationConflict(error: unknown) {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: unknown }).code === 'PT409'
  );
}

export async function reconcileAttemptConflict(
  input: ProgressStoreInput,
  error: unknown,
  queue: MemberRetryQueue,
  repository: MemberProgressRepository,
) {
  if (!isGenerationConflict(error) || !(await repository.refreshGeneration())) return;
  queue.clear();
  input.onStaleGeneration?.();
}
