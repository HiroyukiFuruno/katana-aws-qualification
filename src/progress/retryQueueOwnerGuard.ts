type CurrentRepository = { assertCurrent(): void };

export async function assertCurrentAfterEnqueue(
  repository: CurrentRepository,
  removeEnqueued: () => Promise<void>,
) {
  try {
    repository.assertCurrent();
  } catch (error) {
    try {
      await removeEnqueued();
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], 'Unable to discard a stale learning event.');
    }
    throw error;
  }
}
