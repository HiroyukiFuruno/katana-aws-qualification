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
  await queue.setServerGeneration(await repository.initialize());
  input.onStaleGeneration?.();
}

export function recoverAttempt(
  input: ProgressStoreInput,
  error: unknown,
  queue: MemberRetryQueue | undefined,
  repository: MemberProgressRepository | undefined,
  failed: (error: 'save') => void,
) {
  return (
    queue && repository ? reconcileAttemptConflict(input, error, queue, repository) : Promise.resolve()
  )
    .catch(() => undefined)
    .finally(() => failed('save'));
}
